"""Complimentary stays: room and meal free, approved by MD Sir or GM Sir, and on record.

The desk marks a stay complimentary in the check-in steps. What it would have cost is
kept (`complimentary_value`), so a report can say what was given away and by whose
approval. The stay is then billed at zero, through the same locked nightly rates Kamra
bills from, so nothing in the night audit or the folio needs changing. The restaurant
orders of a complimentary guest are marked NC, so the kitchen and the report see them
but no money is asked for.

How the invoice reads for a complimentary stay is not decided yet; this module leaves
Kamra's invoice as it is.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt

from kamra.authz import require_roles
from kamra.pricing import quote
from kamra_custom import approvers, negotiation
from kamra_custom.assign import is_on

ROLES = ("Front Desk", "Revenue Manager", "Hotel Admin", "Kamra Agent")
MARKABLE = ("Confirmed", "Checked In")


def _room_posted(reservation: str) -> bool:
	return bool(frappe.db.exists("Folio Charge", {"reservation": reservation, "charge_type": ("in", ("Room", "Meal Plan"))}))


def _inputs(res) -> dict:
	"""The system price inputs, without any rate plan or voucher: it is worth its full price."""
	inputs = res.quote_inputs()
	inputs["rate_plan"] = None
	inputs["voucher_code"] = None
	return inputs


def _price(res, neg: dict, meal: bool):
	"""Put `neg` on the reservation as its price, with or without the meal."""
	res.auto_price = 0
	res.amount_before_tax = neg["amount_before_tax"]
	res.tax_amount = neg["tax_amount"]
	res.amount_after_tax = neg["amount_after_tax"]
	res.discount_amount = 0
	if hasattr(res, "quote_snapshot"):
		res.quote_snapshot = json.dumps(neg, default=str)
	res.set_night_rates(neg)
	if not meal:
		for row in res.night_rates:
			row.meal_amount = 0
	res._apply_commission()


def reprice_free(res) -> None:
	"""A complimentary stay whose dates changed: the new nights are free too. The caller saves."""
	system = quote(**_inputs(res), check_voucher_limits=False)
	free = negotiation.reprice({**system, "meal_total": 0}, res.property, res.room_type, [0] * len(system["nightly"]))
	_price(res, free, meal=False)
	res.rate_lock_key = res.rate_lock_key_for(_inputs(res))
	res.rack_amount_before_tax = system["amount_before_tax"]
	res.complimentary_value = flt(system["amount_after_tax"])


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def mark(reservation: str, approver: str, reason: str = "") -> dict:
	"""Make the stay complimentary: room and meal at zero, with who approved it and why."""
	res = frappe.get_doc("Reservation", reservation)
	res.check_permission("write")
	if res.status not in MARKABLE:
		frappe.throw(_("Only a confirmed or checked-in stay can be made complimentary."))
	if res.get("is_complimentary"):
		frappe.throw(_("This stay is already complimentary."))
	if _room_posted(res.name):
		frappe.throw(_("Room charges are already on the bill. A stay must be made complimentary before its first night is posted."))
	who = approvers.check_complimentary_approver(approver)
	reason = (reason or "").strip()
	if not reason:
		frappe.throw(_("Say why the stay is complimentary."))

	system = quote(**_inputs(res), check_voucher_limits=False)
	free = negotiation.reprice({**system, "meal_total": 0}, res.property, res.room_type, [0] * len(system["nightly"]))
	before = {"amount_after_tax": res.amount_after_tax}
	_price(res, free, meal=False)
	res.rate_lock_key = res.rate_lock_key_for(_inputs(res))
	res.rack_amount_before_tax = system["amount_before_tax"]
	res.is_complimentary = 1
	res.complimentary_approver = who
	res.complimentary_reason = reason
	res.complimentary_value = flt(system["amount_after_tax"])
	res.complimentary_by = frappe.session.user
	res.save()

	from kamra.savings import log_action
	log_action(
		"complimentary", "Reservation", res.name, res.property,
		rationale=f"Complimentary, approved by {who}. {reason} Value {flt(system['amount_after_tax']):,.2f}.",
		before_snapshot=before, after_snapshot={"amount_after_tax": res.amount_after_tax},
	)
	return {"reservation": res.name, "value": res.complimentary_value, "approver": who}


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def unmark(reservation: str) -> dict:
	"""Take the complimentary mark off before anything is billed: the system price comes back."""
	if not negotiation.is_manager():
		frappe.throw(_("Only a manager can undo a complimentary stay."), frappe.PermissionError)
	res = frappe.get_doc("Reservation", reservation)
	if not res.get("is_complimentary"):
		frappe.throw(_("This stay is not complimentary."))
	if _room_posted(res.name):
		frappe.throw(_("Room charges are already on the bill, so this cannot be undone here."))
	system = quote(**_inputs(res), check_voucher_limits=False)
	_price(res, system, meal=True)
	res.auto_price = 1
	# the price is the system price again, so no agreed rate or approver is left on the stay
	res.rate_negotiated = 0
	res.rate_all_in = 0
	res.rate_approved_by = None
	res.is_complimentary = 0
	res.complimentary_approver = None
	res.complimentary_reason = None
	res.complimentary_value = 0
	res.complimentary_by = None
	res.save()
	from kamra.savings import log_action
	log_action("complimentary_undone", "Reservation", res.name, res.property, rationale="Complimentary mark removed.")
	return {"reservation": res.name, "amount_after_tax": res.amount_after_tax}


@frappe.whitelist()
@require_roles(*ROLES)
def status(reservation: str) -> dict:
	"""What the check-in box needs: is it complimentary, who approved it, what it is worth."""
	res = frappe.db.get_value(
		"Reservation", reservation,
		["status", "is_complimentary", "complimentary_approver", "complimentary_reason", "complimentary_value", "property"],
		as_dict=True,
	)
	if not res:
		frappe.throw(_("Booking not found."), frappe.DoesNotExistError)
	frappe.has_permission("Reservation", "read", doc=reservation, throw=True)
	return {
		"complimentary": bool(res.is_complimentary), "approver": res.complimentary_approver, "reason": res.complimentary_reason,
		"value": flt(res.complimentary_value),
		"can_mark": res.status in MARKABLE and not res.is_complimentary and not _room_posted(reservation),
		"can_undo": bool(res.is_complimentary) and negotiation.is_manager() and not _room_posted(reservation),
		"approvers": frappe.get_all("Rate Approver", filters={"disabled": 0, "can_approve_complimentary": 1}, pluck="name"),
	}


def restaurant_nc(doc, method=None):
	"""POS Order.before_save: a complimentary guest's order is NC, recorded but not charged."""
	if doc.nc or not is_on("complimentary_pos_nc", default=True):
		return
	reservation = doc.reservation
	if not reservation and doc.room:
		reservation = frappe.db.get_value("Reservation", {"room": doc.room, "status": "Checked In"})
	if not reservation:
		return
	info = frappe.db.get_value("Reservation", reservation, ["is_complimentary", "complimentary_approver"], as_dict=True)
	if info and info.is_complimentary:
		doc.nc = 1
		doc.nc_authorized_by = info.complimentary_approver
		doc.nc_note = _("Complimentary stay {0}").format(reservation)[:200]
