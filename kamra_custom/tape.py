"""Stays the tape chart leaves out: guests past their check-out date and arrivals without a room.

Kamra's tape chart draws only bookings that have a room and overlap the dates on screen. A guest who is
still checked in after the departure date therefore leaves their room looking empty, and an arrival with no
room is not drawn at all. This is one read that returns both groups; the screen draws them. Kamra's own
`tape_chart` is not changed.
"""

import frappe
from frappe.utils import add_days, getdate, nowdate
from kamra.authz import assert_property_access, require_roles

from kamra_custom.timeutil import hhmm

FIELDS = [
	"name", "room", "guest", "guest_name", "status", "check_in_date", "check_out_date", "is_day_use",
	"adults", "children", "planned_check_in_time", "planned_check_out_time", "source", "booking_type",
	"company", "group_booking",
]


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def extra_stays(property: str, start_date: str | None = None, days: int = 14) -> dict:
	"""`overdue`: checked in, with a room, check-out date before today.
	`unassigned`: confirmed or checked in with no room, overlapping the dates on screen."""
	assert_property_access(property)
	start = getdate(start_date or nowdate())
	end = add_days(start, min(int(days), 31))
	today = getdate(nowdate())

	overdue = frappe.get_all(
		"Reservation",
		filters={
			"property": property, "status": "Checked In", "room": ("is", "set"),
			"check_out_date": ("<", today), "is_day_use": 0,
		},
		fields=FIELDS, order_by="check_out_date asc, name asc",
	)
	unassigned = frappe.get_all(
		"Reservation",
		filters={
			"property": property, "status": ("in", ["Confirmed", "Checked In"]), "room": ("is", "not set"),
			"check_in_date": ("<", end), "check_out_date": (">", start),
		},
		fields=FIELDS, order_by="check_in_date asc, name asc",
	)
	for b in overdue + unassigned:
		for k in ("planned_check_in_time", "planned_check_out_time"):
			b[k] = hhmm(b.get(k)) or None
	return {"today": str(today), "overdue": overdue, "unassigned": unassigned}
