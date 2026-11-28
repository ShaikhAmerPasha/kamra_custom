"""Arrivals that did not come: confirmed bookings whose arrival date has passed.

Kamra's arrivals list holds only the stays due on the day on screen, so a missed arrival drops off it and the
room stays held without anyone being told. The desk snapshot is Kamra's call, with these stays put first in
`arrivals` for today. Each carries `missed` and whether the desk may mark it a no-show now (Kamra allows that
only for an arrival due on or before the business date, which is behind the calendar when the night audit is).
"""

import frappe
from frappe.utils import getdate, nowdate

from kamra_custom.departures import FIELDS


def missed_rows(property: str | None, date: str) -> list:
	if str(date) != nowdate():
		return []
	from kamra.api import _stay_balances
	from kamra.business_date import get_business_date

	filters = {"status": "Confirmed", "check_in_date": ("<", date)}
	if property:
		filters["property"] = property
	rows = frappe.get_all("Reservation", filters=filters, fields=FIELDS + ["property"],
	                      order_by="check_in_date asc, creation asc")
	money = _stay_balances([r.name for r in rows]) if rows else {}
	business = {}
	for r in rows:
		m = money.get(r.name) or {}
		r["paid_total"] = m.get("paid", 0.0)
		r["balance_due"] = m.get("due", 0.0)
		bd = business.setdefault(r.property, getdate(get_business_date(r.property)))
		r["missed"] = True
		r["can_no_show"] = getdate(r.check_in_date) <= bd
	return rows
