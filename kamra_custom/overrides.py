"""Kamra's booking calls, with our extras.

The booking dialog calls `kamra.api.create_booking` and
`kamra.api.create_group_booking`. Frappe lets an app register a function in
their place (`override_whitelisted_methods`). Ours calls Kamra's own function
first, unchanged, and then does what Kamra does not:

* find the returning guest by mobile number in any format, so a typed number
  never makes a second profile;
* keep the guest's remarks where Kamra's screens read them (`special_requests`)
  and add the staff-only `internal_remarks`;
* hold an agreed rate for a room (a walk-in too), with the guardrail, desk limit, reason and log
  from `negotiation`.

Nothing of Kamra's is copied here, so a fix in Kamra's booking code still applies.
"""

import inspect

import frappe
from frappe import _

from kamra_custom import negotiation
from kamra_custom.booking import find_guest_by_phone


def _accepted(fn, kwargs: dict) -> dict:
	"""Only the arguments `fn` takes.

	Frappe drops request fields a function does not name, but only when the
	function has no **kwargs. Ours has, so the request's own bookkeeping fields
	(`cmd` and the like) would reach Kamra's function and fail there.
	"""
	params = inspect.signature(fn).parameters
	if any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values()):
		return kwargs
	return {k: v for k, v in kwargs.items() if k in params}


def _text(instructions) -> str:
	"""The desk's own note from the instruction rows the dialog sends."""
	rows = frappe.parse_json(instructions) if isinstance(instructions, str) else instructions
	return "\n".join(
		(r.get("instruction") or "").strip()
		for r in (rows or [])
		if r.get("department") == "Front Desk" and (r.get("instruction") or "").strip()
	)


def _finish(name: str, special_requests: str = "", internal_remarks: str = "", custom_rate=None) -> dict | None:
	"""Remarks and agreed rate on a reservation Kamra just created."""
	special_requests = (special_requests or "").strip()
	internal_remarks = (internal_remarks or "").strip()
	if not (special_requests or internal_remarks or custom_rate):
		return None
	doc = frappe.get_doc("Reservation", name)
	if special_requests:
		doc.special_requests = special_requests
	if internal_remarks:
		doc.internal_remarks = internal_remarks
	outcome, reason, approver = None, "", None
	if custom_rate:
		reason = (custom_rate.get("reason") or "").strip()
		approver = custom_rate.get("approver")
		outcome = negotiation.apply_rates(doc, custom_rate["rates"], reason, approver, bool(custom_rate.get("all_in")))
	doc.save()
	if outcome:
		negotiation.log_change(doc, outcome, reason, doc.get("rate_approved_by"))
	return {"amount_after_tax": doc.amount_after_tax} if outcome else None


@frappe.whitelist(methods=["POST"])
def create_booking(*args, internal_remarks=None, custom_rate=None, **kwargs):
	"""kamra.api.create_booking, then our extras."""
	from kamra.api import create_booking as kamra_create_booking

	custom_rate = frappe.parse_json(custom_rate) if isinstance(custom_rate, str) else custom_rate
	if not kwargs.get("guest") and kwargs.get("phone") and kwargs.get("property"):
		kwargs["guest"] = find_guest_by_phone(kwargs["phone"], kwargs["property"])

	res = kamra_create_booking(*args, **_accepted(kamra_create_booking, kwargs))
	changed = _finish(res["reservation"], _text(kwargs.get("instructions")), internal_remarks, custom_rate)
	if changed:
		res = {**res, **changed}
	return res


@frappe.whitelist(methods=["POST"])
def create_group_booking(*args, guest=None, special_requests=None, internal_remarks=None, **kwargs):
	"""kamra.api.create_group_booking, then the guest, remarks and agreed rates it leaves out."""
	from kamra.api import create_group_booking as kamra_create_group_booking

	rooms = kwargs.get("rooms")
	specs = frappe.parse_json(rooms) if isinstance(rooms, str) else (rooms or [])
	rates = [s.get("custom_rate") for s in specs]

	# Kamra finds the profile by its exact phone, so hand it the stored number of
	# the guest picked at the desk, or of the guest this number belongs to.
	found = guest or (find_guest_by_phone(kwargs.get("phone"), kwargs.get("property")) if kwargs.get("phone") else None)
	if found:
		stored = frappe.db.get_value("Guest", found, "phone")
		if stored:
			kwargs["phone"] = stored

	out = kamra_create_group_booking(*args, **_accepted(kamra_create_group_booking, kwargs))

	if any(rates) and out["skipped"]:
		# a rate must not land on the wrong room, and Kamra's partial result cannot say which was skipped
		frappe.throw(
			_("Some rooms could not be booked ({0}). Nothing was booked, because agreed rates are set.").format(
				"; ".join(s["reason"] for s in out["skipped"])
			)
		)

	for i, name in enumerate(out["created"]):
		_finish(name, special_requests or "", internal_remarks or "", rates[i] if i < len(rates) else None)
	return out


@frappe.whitelist(methods=["POST"])
def walk_in(*args, internal_remarks=None, custom_rate=None, **kwargs):
	"""kamra.api.walk_in, then the remarks and the agreed rate.

	Kamra's walk-in books through its own function, not through the wrapper above, so
	the agreed rate is applied here, on the reservation it just made. A rule that is
	broken stops the request, and Frappe rolls the whole walk-in back with it.
	"""
	from kamra.api import walk_in as kamra_walk_in

	custom_rate = frappe.parse_json(custom_rate) if isinstance(custom_rate, str) else custom_rate
	if not kwargs.get("guest") and kwargs.get("phone") and kwargs.get("property"):
		kwargs["guest"] = find_guest_by_phone(kwargs["phone"], kwargs["property"])

	res = kamra_walk_in(*args, **_accepted(kamra_walk_in, kwargs))
	changed = _finish(res["reservation"], "", internal_remarks, custom_rate)
	if changed:
		res = {**res, **changed}
	return res


def _held_rates(doc) -> list | None:
	"""What the guest was promised for each night: the agreed all-in rate, or the room rate."""
	if not doc.get("rate_negotiated") or doc.get("auto_price") or not doc.get("night_rates"):
		return None
	rows = sorted(doc.night_rates, key=lambda r: str(r.stay_date))
	inclusive = negotiation.rates_include_tax(doc.property)
	out = []
	for r in rows:
		value = float(r.rate or 0) + (float(r.meal_amount or 0) if doc.get("rate_all_in") else 0)
		if inclusive:
			value = round(value * (1 + float(r.gst_rate or 0) / 100), 2)
		out.append((str(r.stay_date), value))
	return out


@frappe.whitelist(methods=["POST"])
def amend_stay(*args, **kwargs):
	"""kamra.api.amend_stay, then keep the promised price on the new dates.

	Kamra keeps the old total of a stay whose price was agreed by hand, so a stay lengthened
	from one night to two would still bill one night's price and have no rate for the second
	night. Here the agreed rate carries to every night of the new dates (a longer stay uses
	the last night's rate for the added nights), and a complimentary stay stays free.
	"""
	from kamra.api import amend_stay as kamra_amend_stay

	name = kwargs.get("reservation") or (args[0] if args else None)
	doc = frappe.get_doc("Reservation", name)
	held = _held_rates(doc)
	free = bool(doc.get("is_complimentary"))
	out = kamra_amend_stay(*args, **_accepted(kamra_amend_stay, kwargs))
	if not held and not free:
		return out

	doc = frappe.get_doc("Reservation", name)
	if free:
		from kamra_custom import complimentary

		complimentary.reprice_free(doc)
	else:
		by_date = dict(held)
		first, last = held[0][1], held[-1][1]
		nights = int(doc.nights or 0)
		start = frappe.utils.getdate(doc.check_in_date)
		rates = [by_date.get(str(frappe.utils.add_days(start, i)), first if frappe.utils.add_days(start, i) < frappe.utils.getdate(held[0][0]) else last) for i in range(nights)]
		negotiation.apply_rates(doc, rates, doc.get("negotiated_reason") or "", doc.get("rate_approved_by"), bool(doc.get("rate_all_in")), enforce=False)
	doc.save()
	return {**out, "nights": doc.nights, "amount_after_tax": doc.amount_after_tax}
