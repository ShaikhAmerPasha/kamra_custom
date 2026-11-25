"""Two facts about a stay that Kamra stores but its screens do not show together.

* the price night by night, so a desk can see where a total comes from and whether the rate was
  agreed or is the system rate;
* the trail: who made the booking and when, who last changed it, who checked the guest in.

Read only. Everything comes from the reservation and its stored quote.
"""

import json

import frappe
from frappe.utils import flt
from kamra.authz import assert_property_access, require_roles

from kamra_custom.id_on_file import guests_with_id, id_missing


def _who(user) -> str:
	if not user:
		return ""
	return frappe.db.get_value("User", user, "full_name") or str(user).split("@")[0]


def nightly_rows(quote: dict, total: float) -> list[dict]:
	"""One row per night: room, meal, tax and the night's total, then a row for anything else
	(discount, levy) so the rows add up to the booking total."""
	nights = quote.get("nightly") or []
	if not nights:
		return []
	meal_each = flt(quote.get("meal_total")) / len(nights)
	rows = []
	for n in nights:
		room = flt(n.get("rate"))
		gst = flt(n.get("gst_rate"))
		tax = (room + meal_each) * gst / 100
		rows.append({"date": n.get("date"), "room": round(room, 2), "meal": round(meal_each, 2),
		             "tax": round(tax, 2), "total": round(room + meal_each + tax, 2), "gst_rate": gst})
	other = round(flt(total) - sum(r["total"] for r in rows), 2)
	if abs(other) >= 0.01:
		rows.append({"date": None, "label": "other", "room": 0, "meal": 0, "tax": 0, "total": other, "gst_rate": 0})
	return rows


def unposted_amount(reservation: str, status: str, stay_total: float) -> float:
	"""What a stay in house will still be billed for rooms: the booked total less the room charges already
	on the guest bills. Kamra posts a night at the night audit and the rest at check-out, so a guest
	checked in today shows nothing owed on the folio although the stay will be billed."""
	if status != "Checked In" or stay_total <= 0:
		return 0.0
	folios = frappe.get_all("Folio", filters={"reservation": reservation, "folio_type": "Guest"}, pluck="name")
	posted = 0.0
	if folios:
		posted = flt(frappe.db.sql(
			"select coalesce(sum(total), 0) from `tabFolio Charge` where parent in %s and charge_type = 'Room'",
			(tuple(folios),))[0][0])
	return max(0.0, round(stay_total - posted, 2))


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def stay_facts(reservation: str) -> dict:
	r = frappe.db.get_value(
		"Reservation", reservation,
		["name", "property", "owner", "creation", "modified_by", "modified", "checked_in_by", "checked_in_at",
		 "actual_check_in", "actual_check_out", "status", "rate_negotiated", "negotiated_by", "rate_approved_by",
		 "amount_after_tax", "rack_amount_before_tax", "quote_snapshot", "channel", "source", "group_booking",
		 "guest", "room", "id_document", "id_document_discarded"],
		as_dict=True)
	if not r:
		frappe.throw(frappe._("Reservation {0} was not found.").format(reservation))
	assert_property_access(r.property)
	try:
		quote = json.loads(r.quote_snapshot or "{}")
	except ValueError:
		quote = {}
	room_status = frappe.db.get_value("Room", r.room, "housekeeping_status") if r.room else ""
	return {
		"reservation": r.name,
		"unposted": unposted_amount(r.name, r.status, flt(r.amount_after_tax)),
		"id_on_file": not id_missing(r, guests_with_id([r.guest])),
		"room_status": room_status or "",
		"nightly": nightly_rows(quote, flt(r.amount_after_tax)),
		"total": flt(r.amount_after_tax),
		"agreed": bool(r.rate_negotiated),
		"agreed_by": _who(r.negotiated_by or r.rate_approved_by),
		"trail": {
			"reserved_by": _who(r.owner), "reserved_at": str(r.creation)[:16],
			"changed_by": _who(r.modified_by), "changed_at": str(r.modified)[:16],
			"checked_in_by": _who(r.checked_in_by), "checked_in_at": str(r.checked_in_at or r.actual_check_in or "")[:16],
			"checked_out_at": str(r.actual_check_out or "")[:16],
		},
		"channel": r.channel or "", "source": r.source or "", "group": r.group_booking or "",
	}


def _time(stamp) -> str:
	return str(stamp)[:16] if stamp else ""


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def stay_money(reservation: str) -> dict:
	"""Every bill of the stay with its charges and payments, newest last, for the Money tab.

	A line carries when it was posted and by whom, so the desk can answer "who took this payment".
	Voided charges stay in the list, marked, so the totals can be explained.
	"""
	prop = frappe.db.get_value("Reservation", reservation, "property")
	if not prop:
		frappe.throw(frappe._("Reservation {0} was not found.").format(reservation))
	assert_property_access(prop)
	out = []
	for f in frappe.get_all(
		"Folio", filters={"reservation": reservation},
		fields=["name", "folio_type", "status", "invoice_number", "tax_total", "grand_total", "payments_total", "balance"],
		order_by="creation asc"):
		charges = frappe.get_all(
			"Folio Charge", filters={"parent": f.name},
			fields=["posting_date", "description", "amount", "gst_rate", "gst_amount", "total", "creation", "owner",
			        "void_reason", "voided_by", "reversal_of"],
			order_by="creation asc")
		payments = frappe.get_all(
			"Folio Payment", filters={"parent": f.name},
			fields=["posting_date", "payment_kind", "mode", "amount", "reference", "creation", "owner"],
			order_by="creation asc")
		out.append({
			"folio": f.name, "side": f.folio_type, "status": f.status, "invoice": f.invoice_number or "",
			"tax": flt(f.tax_total), "total": flt(f.grand_total), "paid": flt(f.payments_total), "balance": flt(f.balance),
			"charges": [{
				"date": str(c.posting_date), "at": _time(c.creation), "by": _who(c.owner), "description": c.description or "",
				"amount": flt(c.amount), "gst_rate": flt(c.gst_rate), "gst": flt(c.gst_amount), "total": flt(c.total),
				"void": bool(c.void_reason or c.voided_by), "reason": c.void_reason or "",
			} for c in charges],
			"payments": [{
				"date": str(p.posting_date), "at": _time(p.creation), "by": _who(p.owner), "kind": p.payment_kind or "",
				"mode": p.mode or "", "amount": flt(p.amount), "reference": p.reference or "",
			} for p in payments],
		})
	return {"reservation": reservation, "folios": out}
