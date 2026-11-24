"""Which card network a card payment came from (Visa, RuPay, ...), kept next to the payment.

The desk picks the network from the card machine slip. The screen sends
`card_network` (and optionally `card_last4`) with the same request that records
the payment. These hooks copy them onto the new payment line, so every screen
that takes a card payment gets the same behaviour without a change to each API.
Only the network and the last four digits are kept: never the full number.
"""

import re

import frappe
from frappe import _

NETWORKS = [
	"Visa", "Mastercard", "RuPay", "American Express", "Diners Club", "Discover",
	"JCB", "UnionPay", "Maestro", "Mir", "Elo", "Other",
]


def clean(network, last4):
	"""Return (network, last4) checked, or (None, None) when the request carried none."""
	network = (network or "").strip()
	last4 = (last4 or "").strip()
	if not network:
		return None, None
	if network not in NETWORKS:
		frappe.throw(_("Card network must be one of: {0}.").format(", ".join(NETWORKS)))
	if last4 and not re.fullmatch(r"\d{4}", last4):
		frappe.throw(_("Give exactly the last 4 digits of the card, or leave it empty."))
	return network, last4 or None


def _from_request():
	form = frappe.form_dict
	return clean(form.get("card_network"), form.get("card_last4"))


def on_folio_save(doc, method=None):
	"""Stamp the card network on card payment lines added in this request."""
	network, last4 = _from_request()
	if not network:
		return
	for row in doc.get("payments") or []:
		if row.mode == "Card" and not row.get("card_network") and row.is_new():
			row.card_network = network
			row.card_last4 = last4


def on_pos_order_save(doc, method=None):
	"""Stamp the card network on an outlet bill that was just paid by card."""
	network, last4 = _from_request()
	if not network or doc.payment_mode != "Card" or not doc.paid:
		return
	if not doc.get("card_network"):
		doc.card_network = network
		doc.card_last4 = last4


def card_collections(property: str, day):
	"""Card money received on a day, split by network: room payments and restaurant bills.
	Rows without a network count as 'Not recorded'."""
	rows = frappe.db.sql(
		"""
		SELECT COALESCE(NULLIF(p.card_network, ''), 'Not recorded') AS network,
		       SUM(p.amount) AS amount, COUNT(*) AS n
		FROM `tabFolio Payment` p JOIN `tabFolio` f ON f.name = p.parent
		WHERE f.property = %(property)s AND p.posting_date = %(day)s AND p.mode = 'Card'
		GROUP BY network
		""",
		{"property": property, "day": day},
		as_dict=True,
	)
	# bills paid by card at a restaurant outlet: the guest pays the bill with its tax
	from kamra.pos import _bill_tax

	for o in frappe.get_all(
		"POS Order",
		filters={"property": property, "business_date": day, "paid": 1, "payment_mode": "Card", "posted_to_folio": 0},
		fields=["name", "card_network"],
	):
		doc = frappe.get_doc("POS Order", o.name)
		rows.append(frappe._dict(
			network=o.card_network or "Not recorded",
			amount=float(doc.order_total or 0) + _bill_tax(doc)[1],
			n=1,
		))
	out: dict[str, dict] = {}
	for r in rows:
		o = out.setdefault(r.network, {"network": r.network, "amount": 0.0, "lines": 0})
		o["amount"] += float(r.amount or 0)
		o["lines"] += int(r.n)
	for o in out.values():
		o["amount"] = round(o["amount"], 2)
	return sorted(out.values(), key=lambda x: -x["amount"])
