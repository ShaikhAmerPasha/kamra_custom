"""One screen for the manager: today's house, in one call.

It gathers what Kamra already works out, so every figure matches its own screens:
the Today / month / year comparison (`kamra.dashboards.comparison`), the day's movement
(`kamra.reports.movement_counts`), what guests and companies owe, and, from this app, collections by
mode and the Needs attention counts. Nothing is recomputed here.
"""

from inspect import unwrap

import frappe
from frappe.utils import add_days, date_diff, flt, nowdate
from kamra.authz import assert_property_access, require_roles

from kamra_custom import attention as attention_module
from kamra_custom import cashier

LEDGER_BUCKETS = ("not_due", "d1_30", "d31_60", "d61_90", "d90p")
PERIOD_KEYS = ("rooms_sold", "occupancy_pct", "room_revenue", "total_revenue", "adr", "revpar")


def _periods(property: str, date: str, total_rooms: int) -> dict:
	from kamra.dashboards import comparison

	out = {}
	for p in comparison(property, date, total_rooms, [])["periods"]:
		if p["id"] not in ("today", "mtd", "ytd"):
			continue
		this, last = p["this_year"], p["last_year"]
		out[p["id"]] = {
			"from": p["from_date"], "to": p["to_date"],
			"this": {k: flt(this.get(k)) for k in PERIOD_KEYS},
			"last": {k: flt(last.get(k)) for k in PERIOD_KEYS},
			"change_pct": {k: p["change_pct"].get(k) for k in PERIOD_KEYS},
		}
	return out


def _rooms(property: str) -> dict:
	rows = frappe.db.sql(
		"""SELECT housekeeping_status AS hk, COUNT(*) AS n FROM `tabRoom` WHERE property = %s GROUP BY housekeeping_status""",
		(property,), as_dict=True)
	by = {r.hk: int(r.n) for r in rows}
	return {"total": sum(by.values()), "clean": by.get("Clean", 0), "dirty": by.get("Dirty", 0),
	        "inspected": by.get("Inspected", 0), "out_of_order": by.get("Out of Order", 0)}


def _guests_in_house(property: str) -> dict:
	"""Who is in the house right now: adults, children, and stays given free."""
	r = frappe.db.sql(
		"""SELECT COALESCE(SUM(adults), 0) AS adults, COALESCE(SUM(children), 0) AS children,
		          COALESCE(SUM(CASE WHEN is_complimentary = 1 THEN 1 ELSE 0 END), 0) AS complimentary
		   FROM `tabReservation` WHERE property = %s AND status = 'Checked In'""",
		(property,), as_dict=True)[0]
	return {"adults": int(r.adults or 0), "children": int(r.children or 0), "complimentary": int(r.complimentary or 0)}


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def house_today(property: str) -> dict:
	from kamra.business_date import get_business_date
	from kamra.dashboards import _open_folio_totals
	from kamra.ledger import city_ledger_aging
	from kamra.reports import movement_counts

	if not frappe.db.exists("Property", property):
		frappe.throw(frappe._("Property {0} was not found.").format(property))
	assert_property_access(property)
	date = str(get_business_date(property))
	total_rooms = frappe.db.count("Room", {"property": property}) or 0

	periods = _periods(property, date, total_rooms)
	guest_owed, open_bills = _open_folio_totals(property)
	ledger = unwrap(city_ledger_aging)(property)["totals"]
	company_owed = sum(flt(ledger.get(k)) for k in LEDGER_BUCKETS)
	attn = attention_module.attention(property)
	collected = cashier.collections(property)

	return {
		"property": property,
		"business_date": date,
		"calendar_date": nowdate(),
		"days_behind": max(0, date_diff(nowdate(), date)),
		"total_rooms": total_rooms,
		"periods": periods,
		"movement": {"today": movement_counts(property, date, date),
		             "tomorrow": movement_counts(property, str(add_days(date, 1)), str(add_days(date, 1)))},
		"rooms": _rooms(property),
		"guests": _guests_in_house(property),
		"attention": {"total": attn["total"], "groups": [{"key": g["key"], "label": g["label"], "count": g["count"]} for g in attn["groups"]]},
		"collected": {"total": flt(collected["total"]), "refunds": flt(collected["refunds"]), "by_mode": collected["by_mode"],
					 "by_card_network": collected["by_card_network"]},
		"owed": {"guests": flt(guest_owed), "open_bills": int(open_bills), "companies": flt(company_owed), "overdue": flt(ledger.get("overdue"))},
	}
