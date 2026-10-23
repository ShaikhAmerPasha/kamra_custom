"""Negotiated room rates.

Hotels bargain. Kamra prices a booking from its engine and bills the nightly
rates stored on the reservation (`night_rates`). Its own switch for a held,
agreed price is `auto_price = 0`: the save path then keeps whatever amounts and
night rates are stored. This module sets those, in one place, with the checks
the desk needs:

* the rate must respect the owner's Rate Guardrails;
* a discount larger than the desk's limit needs a manager;
* the system rate, the agreed rate, who agreed it and why are kept;
* the change goes to Kamra's action log with before and after.

The tax maths is Kamra's `quote()` with one change: the nightly room rates are
the ones we are given. `reprice()` mirrors the part of `quote()` that follows
the nightly rates. A test feeds it the system's own rates and requires the same
totals as `quote()`, so a change in Kamra's maths fails a test instead of a bill.
"""

from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime

from kamra.authz import require_roles
from kamra.pricing import _dec, quote, rates_include_tax, room_gst_rate

MANAGER_ROLES = {"Revenue Manager", "Hotel Admin", "System Manager"}
DEFAULT_MAX_DISCOUNT_PCT = 10.0


# --- the maths ----------------------------------------------------------------

def reprice(q: dict, property: str, room_type: str, entered: list) -> dict:
	"""`q` with its nightly room rates replaced by `entered`.

	`entered` has one rate per billable night, written the way the property
	writes its rates: with tax when `rates_include_tax` is on, else without.
	Meal plan, cleaning fee and room levy follow Kamra's rules.
	"""
	nights = q["nightly"]
	if len(entered) != len(nights):
		frappe.throw(_("Enter a rate for each of the {0} night(s).").format(len(nights)))

	rt = frappe.get_doc("Room Type", room_type)
	inclusive = rates_include_tax(property)

	nightly, room_total, room_tax = [], Decimal(0), Decimal(0)
	for n, e in zip(nights, entered):
		rate = _dec(e)
		if rate < 0:
			frappe.throw(_("A rate cannot be negative."))
		gst = room_gst_rate(property, rt, rate)
		if inclusive:
			rate = rate / (Decimal(1) + gst / Decimal(100))
		nightly.append({
			"date": n["date"], "rate": float(rate), "gst_rate": float(gst),
			"demand_premium_pct": 0, "occupancy": n.get("occupancy"),
		})
		room_total += rate
		room_tax += rate * gst / Decimal(100)

	from kamra.folio import _fnb_gst

	meal_total = _dec(q.get("meal_total") or 0)
	meal_tax = meal_total * _dec(_fnb_gst(property)) / Decimal(100)
	subtotal = room_total + meal_total
	tax = room_tax + meal_tax

	prop = frappe.get_cached_doc("Property", property)
	cleaning = _dec(prop.get("cleaning_fee") or 0)
	total_base = subtotal
	if cleaning > 0:
		avg_gst = (room_tax / room_total * Decimal(100)) if room_total else Decimal(0)
		cleaning_tax = Decimal(0)
		taxable_flag = prop.get("cleaning_fee_taxable")
		if cint(taxable_flag if taxable_flag is not None else 1):
			if inclusive:
				cleaning = cleaning / (Decimal(1) + avg_gst / Decimal(100))
			cleaning_tax = cleaning * avg_gst / Decimal(100)
		tax += cleaning_tax
		total_base = subtotal + cleaning

	levy_pct = _dec(prop.get("room_levy_percent") or 0)
	levy = Decimal(0)
	if levy_pct > 0 and room_total:
		levy = room_total * levy_pct / Decimal(100)
		levy_flag = prop.get("room_levy_taxable")
		if cint(levy_flag if levy_flag is not None else 1):
			tax += levy * (room_tax / room_total)
		total_base += levy

	total = total_base + tax
	out = dict(q)
	out.update({
		"nightly": nightly,
		"room_total": float(room_total),
		"cleaning_fee": float(cleaning) if cleaning > 0 else 0.0,
		"room_levy": float(levy),
		"discount": 0.0,
		"voucher": None,
		"amount_before_tax": float(total_base),
		"tax_percent": round(float(tax / total_base * 100) if total_base else 0, 2),
		"tax_amount": float(tax),
		"amount_after_tax": float(total),
	})
	return out


def discount_pct(system: dict, negotiated: dict) -> float:
	"""How far below the system's room price the agreed price is. Zero if above."""
	base = flt(system.get("room_total"))
	if base <= 0:
		return 0.0
	return max(0.0, (base - flt(negotiated.get("room_total"))) / base * 100)


# --- the rules ----------------------------------------------------------------

def max_desk_discount_pct() -> float:
	"""The desk's limit. Until someone saves the setting, the default applies."""
	rows = frappe.db.sql(
		"select value from tabSingles where doctype = %s and field = %s",
		("Kamra Custom Settings", "max_desk_discount_pct"),
	)
	value = rows[0][0] if rows else None
	return DEFAULT_MAX_DISCOUNT_PCT if value in (None, "") else flt(value)


def is_manager(user: str | None = None) -> bool:
	user = user or frappe.session.user
	return user == "Administrator" or bool(MANAGER_ROLES & set(frappe.get_roles(user)))


def check_guardrails(property: str, room_type: str, nightly: list[dict], entered: list):
	"""Refuse a rate outside the owner's Rate Guardrails."""
	from kamra.api import _assert_within_guardrails

	rails = frappe.get_all(
		"Rate Guardrail",
		filters={"property": property, "disabled": 0, "room_type": ("in", [room_type, "", None])},
		fields=["name", "room_type", "floor_price", "ceiling_price", "days_of_week"],
	)
	for n, e in zip(nightly, entered):
		_assert_within_guardrails(rails, room_type, float(e), n["date"], n["date"])


def check_rules(property: str, room_type: str, nightly: list[dict], entered: list, pct: float):
	"""Refuse a rate the owner's rails or the desk limit do not allow."""
	check_guardrails(property, room_type, nightly, entered)

	limit = max_desk_discount_pct()
	if pct > limit + 1e-9 and not is_manager():
		frappe.throw(
			_("This rate is {0}% below the system rate. The desk can give up to {1}%. "
			  "Ask a Revenue Manager or Hotel Admin to apply it.").format(round(pct, 1), round(limit, 1)),
			frappe.PermissionError,
		)


def quote_inputs_for(res) -> dict:
	"""Kamra's own view of what is being sold, for a saved reservation."""
	inputs = res.quote_inputs()
	if inputs.get("rate_plan") or inputs.get("voucher_code"):
		frappe.throw(
			_("This booking has a rate plan or voucher. Remove it before agreeing a rate by hand."),
			title=_("Cannot negotiate"),
		)
	return inputs


# --- previews and writes --------------------------------------------------------

@frappe.whitelist()
@require_roles("Front Desk", "Revenue Manager", "Kamra Agent")
def preview(property: str, room_type: str, check_in_date: str, check_out_date: str,
            adults: int = 2, children: int = 0, meal_plan: str | None = None,
            rates=None) -> dict:
	"""The system price, and the price at the given nightly rates, without saving."""
	inputs = {
		"property": property, "room_type": room_type,
		"check_in_date": check_in_date, "check_out_date": check_out_date,
		"adults": int(adults), "children": int(children),
		"meal_plan": meal_plan or None, "rate_plan": None, "voucher_code": None,
	}
	system = quote(**inputs, check_voucher_limits=False)
	inclusive = rates_include_tax(property)
	result = {"system": system, "negotiated": None, "discount_pct": 0.0,
	          "limit_pct": max_desk_discount_pct(), "needs_manager": False,
	          "can_approve": is_manager(), "inclusive": inclusive,
	          # the system's nightly rates, written the way a rate is typed at this property
	          "entry_rates": [
		          round(n["rate"] * (1 + n["gst_rate"] / 100) if inclusive else n["rate"], 2)
		          for n in system["nightly"]
	          ]}
	rates = frappe.parse_json(rates) if isinstance(rates, str) else rates
	if rates:
		neg = reprice(system, property, room_type, rates)
		pct = discount_pct(system, neg)
		result.update(negotiated=neg, discount_pct=pct,
		              needs_manager=pct > max_desk_discount_pct() + 1e-9)
		# say now what the booking would be refused for later
		try:
			check_guardrails(property, room_type, system["nightly"], rates)
		except frappe.ValidationError as e:
			result["rule_error"] = frappe.utils.strip_html(str(e))
	return result


def apply_rates(res, rates: list, reason: str = "") -> dict:
	"""Agree `rates` on a saved reservation (a document).

	Checks the rules, holds the price (`auto_price` off), stores the nightly
	rates the folio bills, and records what changed.
	"""
	import json

	reason = (reason or "").strip()
	inputs = quote_inputs_for(res)
	system = quote(**inputs, check_voucher_limits=False)
	neg = reprice(system, res.property, res.room_type, rates)
	pct = discount_pct(system, neg)
	check_rules(res.property, res.room_type, system["nightly"], rates, pct)
	if pct > 0 and not reason:
		frappe.throw(_("Say why the rate was reduced."), title=_("Reason needed"))

	before = {
		"amount_before_tax": res.amount_before_tax, "tax_amount": res.tax_amount,
		"amount_after_tax": res.amount_after_tax, "auto_price": res.auto_price,
		"night_rates": [{"date": str(r.stay_date), "rate": r.rate} for r in res.get("night_rates") or []],
	}

	res.auto_price = 0
	res.amount_before_tax = neg["amount_before_tax"]
	res.tax_amount = neg["tax_amount"]
	res.amount_after_tax = neg["amount_after_tax"]
	res.discount_amount = 0
	if hasattr(res, "quote_snapshot"):
		res.quote_snapshot = json.dumps({**neg, "negotiated": True}, default=str)
	res.set_night_rates(neg)
	res.rate_lock_key = res.rate_lock_key_for(inputs)
	res._apply_commission()
	res.rate_negotiated = 1
	res.rack_amount_before_tax = system["amount_before_tax"]
	res.negotiated_by = frappe.session.user
	res.negotiated_reason = reason or res.get("negotiated_reason")

	after = {
		"amount_before_tax": res.amount_before_tax, "tax_amount": res.tax_amount,
		"amount_after_tax": res.amount_after_tax, "auto_price": 0,
		"night_rates": [{"date": n["date"], "rate": n["rate"]} for n in neg["nightly"]],
		"discount_pct": round(pct, 2),
	}
	return {"before": before, "after": after, "discount_pct": pct, "system": system, "negotiated": neg}


def log_change(res, outcome: dict, reason: str):
	from kamra.savings import log_action

	log_action(
		"negotiate_rate", "Reservation", res.name, res.property,
		rationale=f"{outcome['discount_pct']:.1f}% below system rate. {reason}".strip(),
		before_snapshot=outcome["before"], after_snapshot=outcome["after"],
	)


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Revenue Manager", "Kamra Agent")
def set_negotiated_rate(reservation: str, rates, reason: str = "") -> dict:
	"""Change the agreed nightly rates of a saved reservation."""
	rates = frappe.parse_json(rates) if isinstance(rates, str) else rates
	res = frappe.get_doc("Reservation", reservation)
	frappe.has_permission("Reservation", "write", doc=res, throw=True)
	from kamra.crs import assert_property_access

	assert_property_access(res.property)
	if res.status in ("Checked Out", "Cancelled", "No Show"):
		frappe.throw(_("A {0} booking's rate cannot be changed.").format(res.status))
	_assert_no_posted_nights(res)
	outcome = apply_rates(res, rates, reason)
	res.save()
	log_change(res, outcome, reason)
	return {
		"reservation": res.name,
		"amount_before_tax": res.amount_before_tax,
		"tax_amount": res.tax_amount,
		"amount_after_tax": res.amount_after_tax,
		"discount_pct": outcome["discount_pct"],
	}


def posted_room_charges(res) -> int:
	"""Room charges of this stay already on a folio."""
	folios = frappe.get_all("Folio", filters={"reservation": res.name}, pluck="name")
	if not folios:
		return 0
	return frappe.db.count("Folio Charge", {"parent": ("in", folios), "charge_type": "Room"})


def _assert_no_posted_nights(res):
	"""Nights already billed to the folio keep their rate; changing them needs a folio adjustment."""
	if posted_room_charges(res):
		frappe.throw(
			_("Room nights of this stay are already on the folio. Use a folio adjustment for those nights."),
			title=_("Rate is locked"),
		)
