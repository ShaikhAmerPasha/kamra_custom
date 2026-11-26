"""Group desk: MyCloud's "download" of a master field to the members of a group.

Kamra already checks a group in, assigns its rooms, names its guests and sets its main room. What it
lacks is a way to set one value, such as how the group pays or the GST number, on many rooms at once.
Each open stay is changed on its own, with its own savepoint: one that cannot be changed is reported
with the reason and the rest go on. Nothing here touches a price.
"""

import frappe
from frappe import _

from kamra.authz import require_roles

from kamra_custom import analysis

OPEN = ("Confirmed", "Held", "Pending Payment", "Checked In")
SEGMENTS = ("", "Corporate", "Leisure", "Group", "MICE", "Government")
# what a master field may be sent down as: the billing fields, the segment and the guest's request
FIELDS = analysis.FIELDS + ("market_segment", "special_requests")


def clean(values: dict) -> dict:
	out: dict = {}
	rest = {}
	for key, raw in (values or {}).items():
		if key == "market_segment":
			value = (raw or "").strip()
			if value not in SEGMENTS:
				frappe.throw(_("Choose the market segment from the list."))
			out[key] = value
		elif key == "special_requests":
			out[key] = (raw or "").strip()
		elif key in analysis.FIELDS:
			rest[key] = raw
		else:
			frappe.throw(_("{0} cannot be sent down to the rooms.").format(key))
	out.update(analysis.clean(rest))
	return out


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Kamra Agent")
def download(group_booking: str, reservations, values) -> dict:
	"""Set the given fields on the chosen open rooms of a group. Returns {results, done, failed}."""
	from kamra.crs import assert_property_access

	gb = frappe.get_doc("Group Booking", group_booking)
	assert_property_access(gb.property)
	names = frappe.parse_json(reservations) if isinstance(reservations, str) else (reservations or [])
	names = list(dict.fromkeys(names))
	if not names:
		frappe.throw(_("Tick at least one room."))
	values = clean(frappe.parse_json(values) if isinstance(values, str) else values)
	if not values:
		frappe.throw(_("Tick at least one field to send down."))

	rows = {r.name: r for r in frappe.get_all(
		"Reservation", filters={"name": ("in", names)}, fields=["name", "guest_name", "group_booking", "status"])}
	results = []
	for n in names:
		r = rows.get(n)
		if not r:
			results.append({"reservation": n, "guest_name": "", "ok": False, "message": _("Booking not found.")})
			continue
		if r.group_booking != gb.name:
			results.append({"reservation": n, "guest_name": r.guest_name, "ok": False, "message": _("Not a room of this group.")})
			continue
		if r.status not in OPEN:
			results.append({"reservation": n, "guest_name": r.guest_name, "ok": False, "message": _("The stay is {0}, so it cannot be changed.").format(r.status)})
			continue
		frappe.db.savepoint("group_download")
		try:
			doc = frappe.get_doc("Reservation", n)
			for key, value in values.items():
				doc.set(key, value)
			doc.save()
			results.append({"reservation": n, "guest_name": r.guest_name, "ok": True, "message": _("Updated")})
		except Exception as e:
			frappe.db.rollback(save_point="group_download")
			results.append({"reservation": n, "guest_name": r.guest_name, "ok": False, "message": frappe.utils.strip_html(str(e)) or _("This did not work.")})
		finally:
			frappe.local.message_log = []
	done = sum(1 for x in results if x["ok"])
	return {"results": results, "done": done, "failed": len(results) - done}
