"""What was collected on a day, by payment mode and by cashier, so a shift can be counted without a report."""

import frappe
from kamra.authz import assert_property_access, require_roles

from kamra_custom.card_network import card_collections


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def collections(property: str, date: str | None = None):
	"""Money received on the business date, from the payment lines Kamra keeps on each folio."""
	from kamra.business_date import get_business_date

	assert_property_access(property)
	day = date or get_business_date(property)
	rows = frappe.db.sql(
		"""
		SELECT p.mode AS mode, p.owner AS cashier, p.payment_kind AS kind,
		       SUM(p.amount) AS amount, COUNT(*) AS n_lines
		FROM `tabFolio Payment` p
		JOIN `tabFolio` f ON f.name = p.parent
		WHERE f.property = %(property)s AND p.posting_date = %(day)s
		GROUP BY p.mode, p.owner, p.payment_kind
		""",
		{"property": property, "day": day},
		as_dict=True,
	)
	by_mode: dict[str, dict] = {}
	by_cashier: dict[str, dict] = {}
	refunds = 0.0
	for r in rows:
		amount = float(r.amount or 0)
		if r.kind == "Refund":
			refunds += amount
		m = by_mode.setdefault(r.mode, {"mode": r.mode, "amount": 0.0, "lines": 0})
		m["amount"] += amount
		m["lines"] += int(r.n_lines)
		c = by_cashier.setdefault(r.cashier, {"cashier": r.cashier, "amount": 0.0, "cash": 0.0, "lines": 0})
		c["amount"] += amount
		c["lines"] += int(r.n_lines)
		if r.mode == "Cash":
			c["cash"] += amount
	return {
		"date": str(day),
		"total": round(sum(m["amount"] for m in by_mode.values()), 2),
		"refunds": round(refunds, 2),
		"cash": round(by_mode.get("Cash", {}).get("amount", 0.0), 2),
		"by_mode": sorted(by_mode.values(), key=lambda x: -x["amount"]),
		"by_card_network": card_collections(property, day),
		"by_cashier": sorted(by_cashier.values(), key=lambda x: -x["amount"]),
	}
