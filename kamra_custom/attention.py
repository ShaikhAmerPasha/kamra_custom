"""What needs the desk's attention right now: one list that replaces looking through several screens.

Each group counts every stay that has the problem and names the first few, so the panel stays
short. It only reads what Kamra already stores.
"""

import frappe
from frappe.utils import nowdate, now_datetime
from kamra.authz import assert_property_access, require_roles

SHOW = 5


def _clock_now() -> str:
	return now_datetime().strftime("%H:%M")


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def attention(property: str):
	from kamra.api import _stay_balances

	assert_property_access(property)
	today = nowdate()
	now = _clock_now()
	fields = ["name", "guest_name", "room", "check_in_date", "check_out_date",
	          "planned_check_out_time", "id_document", "id_document_discarded"]
	in_house = frappe.get_all("Reservation", filters={"property": property, "status": "Checked In"},
	                          fields=fields, order_by="room asc")
	arrivals = frappe.get_all("Reservation", filters={"property": property, "status": "Confirmed",
	                          "check_in_date": today}, fields=fields, order_by="creation asc")
	late = frappe.get_all("Reservation", filters={"property": property, "status": "Confirmed",
	                      "check_in_date": ("<", today)}, fields=fields, order_by="check_in_date asc")
	rooms = {r.name: r for r in frappe.get_all(
		"Room", filters={"property": property},
		fields=["name", "room_number", "housekeeping_status", "occupancy_status"])}
	money = _stay_balances([r.name for r in in_house]) if in_house else {}

	def number(room):
		return rooms[room].room_number if room in rooms else (room or "")

	overdue, owing, no_room, not_ready, no_id, no_show = [], [], [], [], [], []
	for r in in_house:
		out_time = str(r.planned_check_out_time or "12:00:00")[:5]
		past = str(r.check_out_date) < today or (str(r.check_out_date) == today and now > out_time)
		due = float((money.get(r.name) or {}).get("due") or 0)
		if past:
			overdue.append({"reservation": r.name, "guest": r.guest_name, "room": number(r.room),
			                "detail": f"due out {out_time}" + (f", owes {due:,.0f}" if due > 0 else ""),
			                "open": "check_out"})
		elif due > 0:
			owing.append({"reservation": r.name, "guest": r.guest_name, "room": number(r.room),
			              "detail": f"owes {due:,.0f}", "open": "bill"})
		if not r.id_document and not r.id_document_discarded:
			no_id.append({"reservation": r.name, "guest": r.guest_name, "room": number(r.room),
			              "detail": "no ID on file", "open": "reservation"})
	for r in arrivals:
		room = rooms.get(r.room) if r.room else None
		if not r.room:
			no_room.append({"reservation": r.name, "guest": r.guest_name, "room": "",
			                "detail": "no room assigned", "open": "reservation"})
		elif room and (room.housekeeping_status in ("Dirty", "Out of Order") or room.occupancy_status == "Occupied"):
			why = "out of order" if room.housekeeping_status == "Out of Order" else (
				"still occupied" if room.occupancy_status == "Occupied" else "dirty")
			not_ready.append({"reservation": r.name, "guest": r.guest_name, "room": room.room_number,
			                  "detail": f"room {room.room_number} is {why}", "open": "reservation"})
	for r in late:
		no_show.append({"reservation": r.name, "guest": r.guest_name, "room": number(r.room),
		                "detail": f"arrival was {r.check_in_date}", "open": "reservation"})

	from kamra.business_date import get_business_date
	from frappe.utils import date_diff

	behind = date_diff(today, get_business_date(property))
	audit = []
	if behind > 0:
		audit.append({"reservation": "", "guest": "Night audit", "room": "",
		              "detail": f"business date is {behind} day{'s' if behind != 1 else ''} behind", "open": "night_audit"})

	groups = [
		("audit_behind", "Night audit not run", audit),
		("overdue", "Past check-out time", overdue),
		("not_ready", "Arrival, room not ready", not_ready),
		("no_room", "Arrival, no room", no_room),
		("no_id", "ID missing, in house", no_id),
		("owing", "Balance due, in house", owing),
		("no_show", "Arrival missed, to mark no-show", no_show),
	]
	out = [{"key": k, "label": label, "count": len(items), "items": items[:SHOW]}
	       for k, label, items in groups if items]
	return {"total": sum(g["count"] for g in out), "groups": out}
