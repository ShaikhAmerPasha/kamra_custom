"""The amount typed for an extra guest is what the guest pays, GST included.

Kamra adds GST on top of the extra-guest amount unless the whole property is set to
tax-inclusive rates. This hotel quotes rooms before tax but agrees extra-guest prices as
a final figure, so the typed amount is converted to the base amount here, and Kamra's own
pricing then adds the GST back and arrives at the same figure the guest was told.
"""

from decimal import ROUND_HALF_UP, Decimal

import frappe


def net_extra_charge(
	property: str,
	room_type: str,
	check_in_date: str,
	check_out_date: str,
	gross,
	adults: int = 2,
	children: int = 0,
	meal_plan: str | None = None,
	rate_plan: str | None = None,
	company: str | None = None,
) -> float:
	"""The per-night base amount that, with GST, comes to `gross`. Zero stays zero.

	GST is read for the first night's room rate plus the extra amount, the way Kamra reads it.
	When the property already prices tax-inclusively, Kamra works backwards itself, so the
	amount is returned unchanged.
	"""
	from kamra.pricing import quote, rates_include_tax, room_gst_rate

	gross = Decimal(str(gross or 0))
	if gross <= 0 or rates_include_tax(property):
		return float(gross)
	base = quote(
		property, room_type, check_in_date, check_out_date, int(adults or 0), int(children or 0),
		meal_plan or None, rate_plan or None, None, check_voucher_limits=False,
		over_capacity_charge=0, company=company or None,
	)
	nightly = base.get("nightly") or []
	rate = Decimal(str(nightly[0]["rate"])) if nightly else Decimal(0)
	rt = frappe.get_doc("Room Type", room_type)
	gst = room_gst_rate(property, rt, rate + gross)
	net = gross / (Decimal(1) + gst / Decimal(100))
	return float(net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def convert(kwargs: dict) -> dict:
	"""kwargs of a quote or booking call, with an extra-guest amount turned into its base amount."""
	gross = kwargs.get("over_capacity_charge")
	needed = ("property", "room_type", "check_in_date", "check_out_date")
	if not gross or not all(kwargs.get(k) for k in needed):
		return kwargs
	out = dict(kwargs)
	out["over_capacity_charge"] = net_extra_charge(
		kwargs["property"], kwargs["room_type"], kwargs["check_in_date"], kwargs["check_out_date"], gross,
		adults=kwargs.get("adults", 2), children=kwargs.get("children", 0),
		meal_plan=kwargs.get("meal_plan"), rate_plan=kwargs.get("rate_plan"), company=kwargs.get("company"),
	)
	return out
