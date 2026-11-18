"""Extra charges added at check-out: airport drop, laundry, a tour. GST is added on top of the amount.

The hotel's own services (Kamra's Experience records) give the quick items and their usual amount
and GST rate; any item can also be typed in. The GST rate must be one the country allows, the same
rule Kamra applies to every charge posted by hand.
"""

import frappe
from kamra.authz import assert_property_access, require_roles

ROLES = ("Finance", "Front Desk", "Kamra Agent")
MAX_ITEMS = 10
CHARGE_TYPE = "Misc"


def _round(n: float) -> float:
	return round(float(n) + 1e-9, 2)


@frappe.whitelist()
@require_roles(*ROLES)
def catalog(property: str):
	"""The quick items for this hotel and the GST rates a charge may carry."""
	from kamra.localization import pack_for

	assert_property_access(property)
	items = frappe.get_all(
		"Experience", filters={"property": property, "disabled": 0},
		fields=["name", "experience_name", "category", "price", "gst_rate"], order_by="category asc, experience_name asc",
	)
	rates = sorted({float(r) for r in pack_for(property).tax_rate_options(property)})
	return {"items": items, "gst_rates": rates}


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def post_extras(folio: str, items):
	"""Put each item on the bill with GST on top of its amount. All of them go on, or none do."""
	from kamra.api import add_folio_charge

	items = frappe.parse_json(items) if isinstance(items, str) else (items or [])
	if not items:
		frappe.throw("Add at least one charge.")
	if len(items) > MAX_ITEMS:
		frappe.throw(f"Add at most {MAX_ITEMS} charges at a time.")
	for i in items:
		if not (i.get("description") or "").strip():
			frappe.throw("Every charge needs a name.")
	frappe.db.savepoint("extras")
	try:
		for i in items:
			add_folio_charge(
				folio, CHARGE_TYPE, i["description"].strip(), float(i["amount"]), float(i.get("gst_rate") or 0),
			)
	except Exception:
		frappe.db.rollback(save_point="extras")
		raise
	doc = frappe.get_doc("Folio", folio)
	return {
		"posted": len(items),
		"balance": _round(doc.balance),
		"total": _round(sum(float(i["amount"]) * (1 + float(i.get("gst_rate") or 0) / 100) for i in items)),
	}
