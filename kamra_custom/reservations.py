"""Find a stay, see its agreed rate and remarks, and change them."""

import frappe
from frappe import _

from kamra.authz import require_roles
from kamra_custom import negotiation
from kamra_custom.phone import digits, to_key
from kamra_custom.guests import property_region

LIST_FIELDS = [
	"name", "guest", "guest_name", "room", "room_type", "status", "check_in_date", "check_out_date",
	"nights", "adults", "children", "amount_after_tax", "advance_paid", "rate_negotiated",
]
CLOSED = ("Checked Out", "Cancelled", "No Show")


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Kamra Agent")
def find(property: str, query: str = "", limit: int = 20) -> list[dict]:
	"""Stays by guest name, mobile number, room or reservation number. Newest first."""
	from kamra.crs import assert_property_access

	assert_property_access(property)
	q = (query or "").strip()
	filters = {"property": property}
	or_filters = None
	if q:
		like = f"%{q}%"
		or_filters = [["name", "like", like], ["guest_name", "like", like], ["room", "like", like]]
		if len(digits(q)) >= 4 and not any(c.isalpha() for c in q):
			key = to_key(q, property_region(property))
			guests = frappe.get_all(
				"Guest",
				or_filters=[["phone_key", "=", key], ["phone_key", "like", f"%{digits(q)}"]],
				pluck="name",
				limit=50,
			)
			if guests:
				or_filters.append(["guest", "in", guests])
	return frappe.get_all(
		"Reservation", filters=filters, or_filters=or_filters, fields=LIST_FIELDS,
		order_by="check_in_date desc, creation desc", limit=int(limit or 20),
	)


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Kamra Agent")
def detail(reservation: str) -> dict:
	"""One stay for the rate and remarks screen."""
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	locked = None
	if res.status in CLOSED:
		locked = _("A {0} booking's rate cannot be changed.").format(res.status)
	elif negotiation.posted_room_charges(res):
		locked = _("Room nights are already on the folio. Use a folio adjustment for those nights.")
	elif res.get("rate_plan") or res.get("voucher"):
		locked = _("This booking has a rate plan or voucher. Remove it before agreeing a rate by hand.")
	return {
		"reservation": res.name, "status": res.status, "property": res.property,
		"guest_name": res.guest_name, "room": res.room, "room_type": res.room_type,
		"check_in_date": str(res.check_in_date), "check_out_date": str(res.check_out_date),
		"adults": res.adults, "children": res.children, "meal_plan": res.meal_plan,
		"amount_before_tax": res.amount_before_tax, "tax_amount": res.tax_amount,
		"amount_after_tax": res.amount_after_tax, "advance_paid": res.advance_paid,
		"night_rates": [{"date": str(r.stay_date), "rate": r.rate, "gst_rate": r.gst_rate} for r in res.get("night_rates") or []],
		"rate_negotiated": cint_(res.get("rate_negotiated")),
		"negotiated_reason": res.get("negotiated_reason"), "negotiated_by": res.get("negotiated_by"),
		"special_requests": res.special_requests, "internal_remarks": res.get("internal_remarks"),
		"rate_locked_reason": locked,
	}


def cint_(v) -> int:
	return int(v or 0)


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Kamra Agent")
def save_remarks(reservation: str, booking_instructions: str = "", internal_remarks: str = "") -> dict:
	"""Change the two remark boxes of a stay. The change is in the document history."""
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	frappe.has_permission("Reservation", "write", doc=res, throw=True)
	res.special_requests = (booking_instructions or "").strip()
	res.internal_remarks = (internal_remarks or "").strip()
	res.save()
	return {"reservation": res.name}
