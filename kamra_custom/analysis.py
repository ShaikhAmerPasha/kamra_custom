"""Billing and analysis details of a stay, and who touched it when.

MyCloud keeps these on the booking form: how the guest pays, tax exemption, GST and PAN, credit
limit, guaranteed, special guest, business source and domicile. Kamra has no place for them, so
they are Custom Fields on Reservation (see setup.py). Nothing here changes a price or a tax.
"""

import re

import frappe
from frappe import _

from kamra.authz import require_roles

FIELDS = (
	"pay_by", "tax_exempt", "gst_number", "pan_number", "credit_limit",
	"guaranteed", "special_guest", "business_source", "domicile",
)
CHECKS = ("tax_exempt", "guaranteed", "special_guest")
PAY_BY = ("", "Cash", "Card", "UPI", "Bank transfer", "Company", "Credit")
CLOSED = ("Checked Out", "Cancelled", "No Show")
GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def clean(values: dict) -> dict:
	"""The values of this module's fields, checked. Raises a message the desk can read."""
	out: dict = {}
	for key, raw in (values or {}).items():
		if key not in FIELDS:
			frappe.throw(_("{0} is not a field of this form.").format(key))
		if key in CHECKS:
			out[key] = 1 if str(raw).lower() in ("1", "true", "yes") else 0
		elif key == "credit_limit":
			try:
				amount = float(raw or 0)
			except (TypeError, ValueError):
				frappe.throw(_("Credit limit must be a number."))
			if amount < 0:
				frappe.throw(_("Credit limit cannot be negative."))
			out[key] = amount
		elif key == "pay_by":
			value = (raw or "").strip()
			if value not in PAY_BY:
				frappe.throw(_("Choose how the guest pays from the list."))
			out[key] = value
		elif key == "gst_number":
			value = (raw or "").strip().upper()
			if value and not GST_RE.match(value):
				frappe.throw(_("The GST number must have 15 letters and digits, like 33ABCDE1234F1Z5."))
			out[key] = value
		elif key == "pan_number":
			value = (raw or "").strip().upper()
			if value and not PAN_RE.match(value):
				frappe.throw(_("The PAN must have 10 characters, like ABCDE1234F."))
			out[key] = value
		else:
			out[key] = (raw or "").strip()
	return out


def apply(doc, values: dict) -> None:
	"""Set cleaned values on a Reservation document (no save)."""
	for key, value in clean(values).items():
		doc.set(key, value)


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Night Auditor", "Kamra Agent")
def get(reservation: str) -> dict:
	"""The billing and analysis fields of a stay and its audit line (who booked, amended, checked in or out)."""
	from kamra.crs import assert_property_access

	doc = frappe.get_doc("Reservation", reservation)
	assert_property_access(doc.property)
	name_of = lambda user: (frappe.db.get_value("User", user, "full_name") or user) if user else None  # noqa: E731
	return {
		"reservation": doc.name,
		"status": doc.status,
		"editable": doc.status not in CLOSED,
		"values": {k: (doc.get(k) or ("" if k not in CHECKS and k != "credit_limit" else 0)) for k in FIELDS},
		"audit": {
			"reserved_by": name_of(doc.owner), "reserved_on": str(doc.creation),
			"amended_by": name_of(doc.modified_by) if doc.modified != doc.creation else None,
			"amended_on": str(doc.modified) if doc.modified != doc.creation else None,
			"checked_in_by": name_of(doc.get("checked_in_by")),
			"checked_in_on": str(doc.get("actual_check_in") or doc.get("checked_in_at") or "") or None,
			"checked_out_on": str(doc.get("actual_check_out") or "") or None,
		},
	}


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Kamra Agent")
def save(reservation: str, values) -> dict:
	"""Change the billing and analysis fields of a stay that is still open. The change is in the document history."""
	from kamra.crs import assert_property_access

	doc = frappe.get_doc("Reservation", reservation)
	assert_property_access(doc.property)
	frappe.has_permission("Reservation", "write", doc=doc, throw=True)
	if doc.status in CLOSED:
		frappe.throw(_("A {0} booking cannot be changed.").format(doc.status))
	apply(doc, frappe.parse_json(values) if isinstance(values, str) else values)
	doc.save()
	return get(doc.name)
