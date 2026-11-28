"""Departures that are late: guests still checked in after their departure date.

Kamra's departure list holds only the stays whose departure date is the day on screen, so a guest who has
not left by midnight drops off it and the Departures count reads 0 while the room is still taken. The desk
snapshot is Kamra's call, with these stays put first in `departures` for today. They are the same kind of
row, so every screen that reads the snapshot (Today, In House) shows them with no change.
"""

import frappe
from frappe.utils import nowdate

FIELDS = [
	"name", "guest_name", "room_type", "room", "status", "source", "check_in_date", "check_out_date", "nights",
	"adults", "children", "special_requests", "channel", "precheckin_status", "eta", "precheckin_token",
	"booked_by_name", "booked_by_phone", "booker_relation", "contact_preference", "company",
]


def overdue_rows(property: str | None, date: str) -> list:
	"""Stays checked in whose departure date is before today. Only for today's list: on any other day the
	list is what leaves that day."""
	if str(date) != nowdate():
		return []
	from kamra.api import _stay_balances

	filters = {"status": "Checked In", "check_out_date": ("<", date)}
	if property:
		filters["property"] = property
	rows = frappe.get_all("Reservation", filters=filters, fields=FIELDS, order_by="check_out_date asc, room asc")
	money = _stay_balances([r.name for r in rows]) if rows else {}
	for r in rows:
		m = money.get(r.name) or {}
		r["paid_total"] = m.get("paid", 0.0)
		r["balance_due"] = m.get("due", 0.0)
	return rows
