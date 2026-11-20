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


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Kamra Agent", "Finance", "Revenue Manager")
def stay_facts(reservation: str) -> dict:
	r = frappe.db.get_value(
		"Reservation", reservation,
		["name", "property", "owner", "creation", "modified_by", "modified", "checked_in_by", "checked_in_at",
		 "actual_check_in", "actual_check_out", "status", "rate_negotiated", "negotiated_by", "rate_approved_by",
		 "amount_after_tax", "rack_amount_before_tax", "quote_snapshot", "channel", "source", "group_booking"],
		as_dict=True)
	if not r:
		frappe.throw(frappe._("Reservation {0} was not found.").format(reservation))
	assert_property_access(r.property)
	try:
		quote = json.loads(r.quote_snapshot or "{}")
	except ValueError:
		quote = {}
	return {
		"reservation": r.name,
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
