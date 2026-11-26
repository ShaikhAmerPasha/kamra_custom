"""Proforma invoice: what a stay, or a group, is projected to cost, before anything is billed.

MyCloud's proforma lists the room and meal of every night with tax. This one is built from the booking's own
stored nightly rates and totals, so it always ends on the booking's total: whatever the nights do not explain
(cleaning fee, add-ons, levies, rounding) is shown as "Other charges", never dropped. Nothing is posted.
"""

import frappe
from frappe import _
from frappe.utils import flt

from kamra.authz import require_roles

ROLES = ("Front Desk", "Finance", "Revenue Manager", "Night Auditor", "Kamra Agent")
CLOSED_NO_BILL = ("Cancelled",)


def _line(date, code, text, amount, rate) -> dict:
	tax = round(flt(amount) * flt(rate) / 100, 2)
	return {"date": str(date) if date else "", "code": code, "description": text, "amount": round(flt(amount), 2),
	        "tax_rate": flt(rate), "tax": tax, "total": round(flt(amount) + tax, 2)}


def for_reservation(res) -> dict:
	"""The proforma of one stay as a dict (lines, totals, paid and balance)."""
	from kamra.folio import _fnb_gst

	meal_gst = flt(_fnb_gst(res.property))
	lines = []
	for n in sorted(res.get("night_rates") or [], key=lambda r: str(r.stay_date)):
		lines.append(_line(n.stay_date, "Room", _("Room charge"), n.rate, n.gst_rate))
		if flt(n.meal_amount) > 0:
			lines.append(_line(n.stay_date, "Meal Plan", _("Meal plan"), n.meal_amount, meal_gst))
	before = round(sum(l["amount"] for l in lines), 2)
	tax = round(sum(l["tax"] for l in lines), 2)
	want_before, want_tax = round(flt(res.amount_before_tax), 2), round(flt(res.tax_amount), 2)
	# what the nights do not explain, so the proforma ends on the booking's own total
	if abs(want_before - before) > 0.009 or abs(want_tax - tax) > 0.009:
		rest = round(want_before - before, 2)
		rest_tax = round(want_tax - tax, 2)
		lines.append({"date": "", "code": "Other", "description": _("Other charges"), "amount": rest,
		              "tax_rate": round(rest_tax / rest * 100, 2) if rest else 0, "tax": rest_tax, "total": round(rest + rest_tax, 2)})
	total = round(sum(l["total"] for l in lines), 2)
	paid = round(flt(res.advance_paid), 2)
	return {
		"reservation": res.name, "guest_name": res.guest_name, "room_type": res.room_type, "room": res.room,
		"check_in_date": str(res.check_in_date), "check_out_date": str(res.check_out_date), "nights": res.nights,
		"status": res.status, "lines": lines,
		"amount": round(sum(l["amount"] for l in lines), 2), "tax": round(sum(l["tax"] for l in lines), 2), "total": total,
		"paid": paid, "balance": round(total - paid, 2),
	}


def _hotel(property: str) -> dict:
	prop = frappe.get_doc("Property", property)
	return {"name": prop.property_name, "gstin": prop.get("gstin"), "phone": prop.get("phone"), "email": prop.get("email"),
	        "address": ", ".join(x for x in (prop.get("address_line"), prop.get("city"), prop.get("state"), prop.get("pincode")) if x)}


@frappe.whitelist()
@require_roles(*ROLES)
def reservation(reservation: str) -> dict:
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	return {"hotel": _hotel(res.property), "currency": frappe.db.get_value("Property", res.property, "currency") or "INR",
	        "stays": [for_reservation(res)], **_totals([for_reservation(res)])}


def _totals(stays: list[dict]) -> dict:
	return {k: round(sum(s[k] for s in stays), 2) for k in ("amount", "tax", "total", "paid", "balance")}


@frappe.whitelist()
@require_roles(*ROLES)
def group(group_booking: str) -> dict:
	"""The proforma of every live room of a group, with the group's totals."""
	from kamra.crs import assert_property_access

	gb = frappe.get_doc("Group Booking", group_booking)
	assert_property_access(gb.property)
	names = frappe.get_all("Reservation", filters={"group_booking": gb.name, "status": ("not in", CLOSED_NO_BILL)}, pluck="name", order_by="creation asc")
	stays = [for_reservation(frappe.get_doc("Reservation", n)) for n in names]
	return {"hotel": _hotel(gb.property), "currency": frappe.db.get_value("Property", gb.property, "currency") or "INR",
	        "group": {"name": gb.name, "group_name": gb.group_name, "company": gb.company,
	                  "check_in_date": str(gb.check_in_date), "check_out_date": str(gb.check_out_date)},
	        "stays": stays, **_totals(stays)}
