"""Actions on several stays at once, from the reservation search grid.

MyCloud lets the desk tick many rows and assign rooms, validate pre-check-in or check in in one go.
Each stay is handled on its own, with Kamra's own rules, and its own savepoint: a stay that cannot be
done is reported with the reason and the others still go through. Nothing here changes a rule.
"""

import frappe
from frappe import _

from kamra.authz import require_roles

ACTIONS = ("assign_rooms", "verify_precheckin", "check_in")
MAX_ROWS = 100


def _reason(e: Exception) -> str:
	"""The message a desk can read, from a Frappe error, without HTML."""
	import re

	text = ""
	for m in reversed(frappe.get_message_log() or []):
		raw = m.get("message") if isinstance(m, dict) else str(m)
		if raw:
			text = raw
			break
	text = text or str(e) or _("This did not work.")
	return re.sub(r"<[^>]+>", "", text).strip()


def _assign_room(name: str, taken: set) -> str:
	"""Give a confirmed stay without a room a free, ready room of its type (the rule of Kamra's allocation)."""
	from kamra.api import available_rooms
	from kamra.savings import log_action

	r = frappe.db.get_value(
		"Reservation", name,
		["property", "room", "status", "room_type", "check_in_date", "check_out_date", "group_booking", "guest_name"],
		as_dict=True,
	)
	if r.status != "Confirmed":
		frappe.throw(_("The stay is {0}, not waiting for arrival.").format(r.status))
	if r.room:
		frappe.throw(_("The stay already has a room."))
	free = [
		f for f in available_rooms(r.property, r.room_type, r.check_in_date, r.check_out_date,
		                           group_booking=r.group_booking, ready_now=1)
		if f["name"] not in taken
	]
	if not free:
		frappe.throw(_("No free room of this type."))
	room = free[0]["name"]
	frappe.db.set_value("Reservation", name, "room", room)
	taken.add(room)
	log_action("allocate_room", "Reservation", name, r.property, minutes_saved=2, rationale=f"-> room {room}. Bulk assign from the search.")
	return frappe.db.get_value("Room", room, "room_number") or room


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Kamra Agent")
def run(action: str, reservations) -> dict:
	"""Do one action on each stay. Returns {results: [{reservation, guest_name, ok, message}], done, failed}."""
	from kamra.crs import assert_property_access

	if action not in ACTIONS:
		frappe.throw(_("Choose an action from the list."))
	names = frappe.parse_json(reservations) if isinstance(reservations, str) else (reservations or [])
	names = list(dict.fromkeys(names))
	if not names:
		frappe.throw(_("Tick at least one booking."))
	if len(names) > MAX_ROWS:
		frappe.throw(_("Choose at most {0} bookings at a time.").format(MAX_ROWS))

	order = {n: i for i, n in enumerate(names)}
	rows = frappe.get_all("Reservation", filters={"name": ("in", names)}, fields=["name", "guest_name", "property", "check_in_date", "creation"])
	rows.sort(key=lambda r: (str(r.check_in_date), str(r.creation), order[r.name]))
	known = {r.name for r in rows}
	results, taken = [], set()
	for n in names:
		if n not in known:
			results.append({"reservation": n, "guest_name": "", "ok": False, "message": _("Booking not found.")})
	for r in rows:
		assert_property_access(r.property)
		frappe.db.savepoint("bulk_row")
		try:
			message = _one(action, r.name, taken)
			results.append({"reservation": r.name, "guest_name": r.guest_name, "ok": True, "message": message})
		except Exception as e:  # one stay failing must not stop the rest
			frappe.db.rollback(save_point="bulk_row")
			results.append({"reservation": r.name, "guest_name": r.guest_name, "ok": False, "message": _reason(e)})
		finally:
			frappe.local.message_log = []
	results.sort(key=lambda x: order.get(x["reservation"], 0))
	done = sum(1 for x in results if x["ok"])
	return {"results": results, "done": done, "failed": len(results) - done}


def _one(action: str, name: str, taken: set) -> str:
	if action == "assign_rooms":
		return _("Room {0}").format(_assign_room(name, taken))
	if action == "verify_precheckin":
		from kamra.api import verify_precheckin

		verify_precheckin(name)
		return _("Pre-check-in verified")
	from kamra.api import check_in

	out = check_in(name)
	pending = out.get("pending_backfill") or []
	room = frappe.db.get_value("Room", out.get("room"), "room_number") if out.get("room") else None
	text = _("Checked in") + (f" · {_('Room')} {room}" if room else "")
	if pending:
		text += " · " + _("still to do: {0}").format(", ".join(p["title"] for p in pending))
	return text
