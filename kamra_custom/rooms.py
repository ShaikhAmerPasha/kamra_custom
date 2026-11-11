"""Rooms out of order: always with a reason, and always until a date.

Kamra sets a room to Out of Order with one click. Here that needs a reason and the date the
room is expected back. Both are kept on a Room Block (Kamra's own record for a room held out of
sale), so the Room Blocks list, the tape chart and the availability search all see the same hold.
"""

import frappe
from frappe import _
from frappe.utils import add_days, getdate, nowdate

MIN_REASON = 3


def _supervisor_only():
	from kamra.api import _is_room_supervisor

	if not _is_room_supervisor():
		frappe.throw(_("Only a housekeeping supervisor can set a room to Out of Order."), frappe.PermissionError)


def current_block(room: str):
	"""The hold that has the room out of order today, if any."""
	today = nowdate()
	return frappe.db.get_value(
		"Room Block",
		{"room": room, "block_status": "Active", "from_date": ("<=", today), "to_date": (">=", today)},
		"name",
	)


@frappe.whitelist(methods=["POST"])
def take_out_of_order(room: str, reason: str, until: str) -> dict:
	"""Put a room out of order today, with the reason and the date it is expected back."""
	from kamra.api import set_housekeeping_status
	from kamra.crs import assert_property_access

	_supervisor_only()
	reason = (reason or "").strip()
	if len(reason) < MIN_REASON:
		frappe.throw(_("Say why the room is out of order."))
	if not until:
		frappe.throw(_("Say until when the room is out of order."))
	if getdate(until) < getdate(nowdate()):
		frappe.throw(_("The date the room is expected back cannot be in the past."))
	prop = frappe.db.get_value("Room", room, "property")
	if not prop:
		frappe.throw(_("Room {0} not found.").format(room), frappe.DoesNotExistError)
	assert_property_access(prop)

	block = current_block(room)
	if not block:
		doc = frappe.get_doc(
			{
				"doctype": "Room Block",
				"property": prop,
				"room": room,
				"from_date": nowdate(),
				"to_date": until,
				"reason": "Maintenance",
				"note": reason,
				"block_status": "Active",
			}
		)
		doc.insert(ignore_permissions=True)
		block = doc.name
	else:
		frappe.db.set_value("Room Block", block, {"to_date": until, "note": reason, "reason": "Maintenance"})
	return {**set_housekeeping_status(room, "Out of Order"), "block": block, "until": str(until), "reason": reason}


@frappe.whitelist(methods=["POST"])
def set_housekeeping_status(room: str, status: str):
	"""Kamra's call, except that Out of Order needs a hold with a reason and a date (see take_out_of_order)."""
	from kamra.api import set_housekeeping_status as kamra_set_housekeeping_status

	if status == "Out of Order" and frappe.db.get_value("Room", room, "housekeeping_status") != "Out of Order":
		if not current_block(room):
			frappe.throw(
				_("Say why the room is out of order and until when. Use Take out of order."),
				title=_("Reason needed"),
			)
	return kamra_set_housekeeping_status(room, status)


def default_until() -> str:
	return add_days(nowdate(), 1)
