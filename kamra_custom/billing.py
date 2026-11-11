"""The Billing list: one row per stay, with its folios grouped.

Kamra's Billing screen lists folios, so a guest with two folios (guest and company, or a split
bill) shows twice and there is no way to search or filter. This gives the screen what it needs:

* search by guest, booking ID (the OTA's PNR for an online booking), invoice or folio number;
* a date range on the bill date (the day the invoice was issued, or the day the folio opened);
* the columns the desk asks for: guest, check-in, check-out, bill date, invoice amount, how it was
  paid, paid, balance, booked through, booking ID;
* every folio of the stay in one row, each with its own invoice.
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate

from kamra.authz import require_roles

MAX_FOLIOS = 3000


def booked_through(r: dict) -> str:
	"""Where the booking came from: the OTA or channel, the company, a walk-in, else direct."""
	if r.get("channel"):
		return r["channel"]
	if r.get("company"):
		return r["company"]
	if (r.get("source") or "").lower() == "walk-in":
		return "Walk-in"
	return "Direct"


def modes_text(rows: list[dict]) -> str:
	"""'Cash, Card' - the ways the money came in, biggest first. Refunds do not count as a way."""
	by_mode: dict[str, float] = {}
	for p in rows:
		if flt(p.get("amount")) > 0:
			by_mode[p["mode"]] = by_mode.get(p["mode"], 0) + flt(p["amount"])
	return ", ".join(m for m, _a in sorted(by_mode.items(), key=lambda kv: -kv[1]))


def build_rows(folios: list[dict], payments: list[dict]) -> list[dict]:
	"""Group folios into one row per stay. A folio with no stay stands alone."""
	pay_by_folio: dict[str, list[dict]] = {}
	for p in payments:
		pay_by_folio.setdefault(p["parent"], []).append(p)
	out: dict[str, dict] = {}
	for f in folios:
		key = f.get("reservation") or f["name"]
		row = out.get(key)
		if row is None:
			row = out[key] = {
				"key": key,
				"reservation": f.get("reservation"),
				"guest": f.get("guest_name") or f.get("rguest") or "-",
				"check_in": str(f["check_in_date"]) if f.get("check_in_date") else "",
				"check_out": str(f["check_out_date"]) if f.get("check_out_date") else "",
				"bill_date": "",
				"amount": 0.0,
				"paid": 0.0,
				"balance": 0.0,
				"booked_through": booked_through(f),
				"booking_id": f.get("ota_ref") or f.get("reservation") or "",
				"folios": [],
				"_pay": [],
			}
		bill = str(f["bill_dt"])[:10] if f.get("bill_dt") else ""
		row["bill_date"] = max(row["bill_date"], bill)
		row["amount"] += flt(f.get("grand_total"))
		row["paid"] += flt(f.get("payments_total"))
		row["balance"] += flt(f.get("balance"))
		row["_pay"] += pay_by_folio.get(f["name"], [])
		row["folios"].append(
			{
				"name": f["name"],
				"type": f.get("folio_type") or "Guest",
				"status": f.get("status"),
				"invoice_number": f.get("invoice_number") or "",
				"amount": flt(f.get("grand_total")),
				"balance": flt(f.get("balance")),
			}
		)
	rows = list(out.values())
	for r in rows:
		r["payment_modes"] = modes_text(r.pop("_pay"))
		r["status"] = "Open" if any(x["status"] == "Open" for x in r["folios"]) else "Closed"
	return rows


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Kamra Agent")
def stays(property: str, q: str = "", date_from: str | None = None, date_to: str | None = None,
          status: str = "", start: int = 0, limit: int = 50) -> dict:
	"""One page of the Billing list, newest bill first."""
	from kamra.crs import assert_property_access

	assert_property_access(property)
	if date_from and date_to and getdate(date_from) > getdate(date_to):
		frappe.throw(_("The From date is after the To date."))
	where = ["f.property = %(property)s"]
	args: dict = {"property": property, "cap": MAX_FOLIOS}
	if date_from:
		where.append("date(coalesce(f.closed_on, f.creation)) >= %(date_from)s")
		args["date_from"] = date_from
	if date_to:
		where.append("date(coalesce(f.closed_on, f.creation)) <= %(date_to)s")
		args["date_to"] = date_to
	if status in ("Open", "Closed"):
		where.append("f.status = %(status)s")
		args["status"] = status
	q = (q or "").strip()
	if q:
		args["like"] = f"%{q}%"
		where.append(
			"(f.guest_name like %(like)s or f.name like %(like)s or f.invoice_number like %(like)s"
			" or f.reservation like %(like)s or r.ota_ref like %(like)s or r.guest_name like %(like)s)"
		)
	folios = frappe.db.sql(
		f"""select f.name, f.reservation, f.guest_name, f.status, f.invoice_number, f.grand_total,
		           f.payments_total, f.balance, f.folio_type, coalesce(f.closed_on, f.creation) as bill_dt,
		           r.check_in_date, r.check_out_date, r.source, r.channel, r.ota_ref, r.company,
		           r.guest_name as rguest
		    from `tabFolio` f left join `tabReservation` r on r.name = f.reservation
		    where {' and '.join(where)}
		    order by bill_dt desc limit %(cap)s""",
		args,
		as_dict=True,
	)
	payments = []
	if folios:
		payments = frappe.get_all(
			"Folio Payment", filters={"parent": ("in", [f["name"] for f in folios])}, fields=["parent", "mode", "amount"]
		)
	rows = build_rows(folios, payments)
	start, limit = max(0, int(start or 0)), max(1, min(int(limit or 50), 200))
	return {"rows": rows[start : start + limit], "total": len(rows), "start": start}
