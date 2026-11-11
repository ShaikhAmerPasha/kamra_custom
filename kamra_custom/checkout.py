"""Check-out extras for the front desk."""

import frappe
from frappe import _
from frappe.utils import flt

from kamra.authz import require_roles


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Kamra Agent")
def settlements(reservation: str) -> list[dict]:
	"""Every payment taken on this stay's folios, oldest first: what the guest has settled so far.

	The final bill shows the same lines. A refund shows as a negative amount.
	"""
	res = frappe.get_doc("Reservation", reservation)
	frappe.has_permission("Reservation", "read", doc=res, throw=True)
	from kamra.crs import assert_property_access

	assert_property_access(res.property)
	folios = frappe.get_all("Folio", filters={"reservation": reservation}, pluck="name")
	if not folios:
		return []
	rows = frappe.get_all(
		"Folio Payment",
		filters={"parent": ("in", folios)},
		fields=["parent as folio", "posting_date", "mode", "amount", "reference", "payment_kind", "idx"],
		order_by="posting_date asc, creation asc, idx asc",
	)
	out = []
	for r in rows:
		amount = flt(r.amount)
		refund = (r.payment_kind or "").lower() == "refund"
		out.append(
			{
				"folio": r.folio,
				"date": str(r.posting_date or ""),
				"mode": r.mode,
				"amount": -abs(amount) if refund else amount,
				"reference": r.reference or "",
				"kind": r.payment_kind or "Payment",
			}
		)
	return out
