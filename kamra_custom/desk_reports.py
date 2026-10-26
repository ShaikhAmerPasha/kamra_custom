"""Front desk reports, each with filters and an Excel download.

Arrivals, departures, in-house guests, the meal plan report and agreed rates by
approver. They read Reservation directly and share one list, one filter form and one
Excel download, so a new report is one entry in `REPORTS` and one function.

Dates default to today and are never fixed in code: the screen sends the date the
user picked.
"""

import frappe
from frappe import _
from frappe.utils import flt, get_datetime, getdate, nowdate

from kamra.authz import require_roles
from kamra_custom.exports import build_xlsx, send_xlsx

ROLES = ("Front Desk", "Night Auditor", "Revenue Manager", "Hotel Admin", "Kamra Agent")
MAX_DAYS = 400

COLUMN = {
	"ref": ("Booking", "text"),
	"guest": ("Guest", "text"),
	"mobile": ("Mobile", "text"),
	"room_type": ("Room type", "text"),
	"room": ("Room", "text"),
	"adults": ("Adults", "number"),
	"children": ("Children", "number"),
	"packs": ("Packs", "number"),
	"plan": ("Plan", "text"),
	"nights": ("Nights", "number"),
	"check_in": ("Check-in", "date"),
	"check_out": ("Check-out", "date"),
	"status": ("Status", "text"),
	"source": ("Source", "text"),
	"advance": ("Advance", "money"),
	"amount": ("Amount", "money"),
	"approver": ("Approved by", "text"),
	"note": ("Note", "text"),
	"booked_on": ("Booked on", "date"),
	"booked_by": ("Booked by", "text"),
	"all_in": ("Includes meal", "text"),
	"cancelled_on": ("Cancelled on", "text"),
	"cancelled_by": ("Cancelled by", "text"),
	"reason": ("Reason", "text"),
	"cancel_no": ("Cancellation no.", "text"),
	"fee": ("Cancellation fee", "money"),
	"when": ("When", "text"),
	"changed_by": ("Changed by", "text"),
	"what": ("What changed", "text"),
	"details": ("Details", "text"),
	"value": ("Value given", "money"),
	"fb_nc": ("Restaurant (NC)", "money"),
}

BASE = """
	select r.name as ref, r.guest_name as guest, g.phone as mobile, rt.room_type_name as room_type,
	       ro.room_number as room, r.adults, r.children, r.adults + r.children as packs,
	       coalesce(mp.code, 'Room only') as plan, r.nights, r.check_in_date as check_in,
	       r.check_out_date as check_out, r.status, r.source, r.advance_paid as advance,
	       r.amount_after_tax as amount, r.rate_approved_by as approver, r.negotiated_reason as note,
	       date(r.creation) as booked_on, r.owner as booked_by, r.rate_all_in as all_in
	from `tabReservation` r
	left join `tabGuest` g on g.name = r.guest
	left join `tabRoom Type` rt on rt.name = r.room_type
	left join `tabRoom` ro on ro.name = r.room
	left join `tabMeal Plan` mp on mp.name = r.meal_plan
"""

LIVE = ("Confirmed", "Checked In", "Checked Out")


def _dates(from_date, to_date):
	start = getdate(from_date or nowdate())
	end = getdate(to_date or start)
	if end < start:
		frappe.throw(_("The end date is before the start date."))
	if (end - start).days > MAX_DAYS:
		frappe.throw(_("Choose at most {0} days.").format(MAX_DAYS))
	return str(start), str(end)


def _plan_clause(plan, params):
	if not plan:
		return ""
	if plan == "Room only":
		return " and r.meal_plan is null"
	params["plan"] = plan
	return " and mp.code = %(plan)s"


def _run(where, params, order, plan=None):
	sql = BASE + " where r.property = %(property)s " + where + _plan_clause(plan, params) + " order by " + order
	return frappe.db.sql(sql, params, as_dict=True)


def _tidy(rows):
	for r in rows:
		if "room" in r and "status" in r:
			r["room"] = r["room"] or ("" if r["status"] in ("Checked Out", "Cancelled") else "Not assigned yet")
		r["all_in"] = "Yes" if r.get("all_in") else ""
		if "mobile" in r:
			r["mobile"] = r["mobile"] or ""
	return rows


def arrivals(property, from_date, to_date, plan=None, **_ignored):
	"""Everyone due to arrive in the dates, whether or not they have checked in yet."""
	start, end = _dates(from_date, to_date)
	rows = _run(
		"and r.check_in_date between %(a)s and %(b)s and r.status in %(s)s",
		{"property": property, "a": start, "b": end, "s": LIVE}, "r.check_in_date, r.guest_name", plan,
	)
	for r in rows:
		r["status"] = {"Confirmed": "Expected", "Checked In": "Arrived", "Checked Out": "Arrived and left"}[r["status"]]
	return rows


def departures(property, from_date, to_date, plan=None, **_ignored):
	"""Everyone due to leave in the dates, whether or not they have checked out yet."""
	start, end = _dates(from_date, to_date)
	rows = _run(
		"and r.check_out_date between %(a)s and %(b)s and r.status in ('Checked In', 'Checked Out')",
		{"property": property, "a": start, "b": end}, "r.check_out_date, ro.room_number", plan,
	)
	for r in rows:
		r["status"] = "Due out" if r["status"] == "Checked In" else "Left"
	return rows


def in_house(property, from_date, to_date=None, plan=None, **_ignored):
	"""Guests staying on a date: in the room that night."""
	day, _end = _dates(from_date, from_date)
	rows = _run(
		"and r.check_in_date <= %(d)s and r.check_out_date > %(d)s and r.status in ('Checked In', 'Checked Out')",
		{"property": property, "d": day}, "ro.room_number, r.guest_name", plan,
	)
	for r in rows:
		r["status"] = "In house" if r["status"] == "Checked In" else "Left"
	return rows


def agreed_rates(property, from_date, to_date, approver=None, **_ignored):
	"""Bookings made at an agreed rate, by who approved it, by the day they were booked."""
	start, end = _dates(from_date, to_date)
	params = {"property": property, "a": start, "b": end}
	where = "and r.rate_negotiated = 1 and date(r.creation) between %(a)s and %(b)s and r.status != 'Cancelled'"
	if approver:
		where += " and r.rate_approved_by = %(approver)s"
		params["approver"] = approver
	return _run(where, params, "r.rate_approved_by, r.creation")


def cancellations(property, from_date, to_date, **_ignored):
	"""Bookings cancelled in the dates, with who cancelled, why and any fee."""
	start, end = _dates(from_date, to_date)
	rows = frappe.db.sql(
		"""
		select r.name as ref, r.guest_name as guest, g.phone as mobile, rt.room_type_name as room_type,
		       r.check_in_date as check_in, r.check_out_date as check_out, r.cancelled_on,
		       r.cancellation_reason as reason, r.cancellation_note as note,
		       r.cancellation_number as cancel_no, r.cancellation_fee as fee, r.amount_after_tax as amount,
		       r.status, '' as room, r.source
		from `tabReservation` r
		left join `tabGuest` g on g.name = r.guest
		left join `tabRoom Type` rt on rt.name = r.room_type
		where r.property = %(property)s and r.status = 'Cancelled' and date(r.cancelled_on) between %(a)s and %(b)s
		order by r.cancelled_on desc
		""",
		{"property": property, "a": start, "b": end}, as_dict=True,
	)
	by = {}
	if rows:
		for log in frappe.get_all(
			"Agent Action Log", filters={"action_type": "cancel_reservation", "reference_name": ("in", [r["ref"] for r in rows])},
			fields=["reference_name", "actor"], order_by="creation asc",
		):
			by[log.reference_name] = log.actor
	for r in rows:
		r["cancelled_on"] = str(r["cancelled_on"] or "")[:16]
		r["cancelled_by"] = _full_name(by.get(r["ref"]))
	return rows


AMEND_FIELDS = {
	"check_in_date": "Check-in date", "check_out_date": "Check-out date", "adults": "Adults", "children": "Children",
	"room_type": "Room type", "room": "Room", "meal_plan": "Meal plan", "amount_after_tax": "Total with tax",
	"rate_approved_by": "Rate approved by", "special_requests": "Guest instructions", "internal_remarks": "Internal remarks",
}


def complimentary(property, from_date, to_date, approver=None, **_ignored):
	"""Complimentary stays that overlap the dates: what was given, who approved it, and the restaurant NC bills."""
	start, end = _dates(from_date, to_date)
	params = {"property": property, "a": start, "b": end}
	where = "and r.is_complimentary = 1 and r.check_in_date <= %(b)s and r.check_out_date > %(a)s and r.status != 'Cancelled'"
	if approver:
		where += " and r.complimentary_approver = %(approver)s"
		params["approver"] = approver
	rows = _run(where, params, "r.check_in_date, r.guest_name")
	if rows:
		nc = {
			x.reservation: flt(x.total)
			for x in frappe.db.sql(
				"select reservation, sum(subtotal) as total from `tabPOS Order` where nc = 1 and reservation in %(r)s group by reservation",
				{"r": tuple(r["ref"] for r in rows)}, as_dict=True,
			)
		}
		meta = {
			x.name: x
			for x in frappe.get_all(
				"Reservation", filters={"name": ("in", [r["ref"] for r in rows])},
				fields=["name", "complimentary_approver", "complimentary_reason", "complimentary_value"],
			)
		}
		for r in rows:
			m = meta[r["ref"]]
			r.update(approver=m.complimentary_approver, reason=m.complimentary_reason, value=flt(m.complimentary_value), fb_nc=nc.get(r["ref"], 0))
	return rows


# the fields each logged amendment already tells about, so the document history does not repeat them
COVERED_BY = {
	"amend_stay": {"check_in_date", "check_out_date", "amount_after_tax"},
	"room_move": {"room", "room_type"},
	"negotiate_rate": {"amount_after_tax", "rate_approved_by"},
}
SAME_CHANGE_SECONDS = 120

LOGGED_AMENDMENTS = {
	"amend_stay": "Dates changed", "room_move": "Room moved", "negotiate_rate": "Agreed rate changed",
	"stay_instruction": "Instructions changed",
}


def amendments(property, from_date, to_date, **_ignored):
	"""Changes made to bookings in the dates: what, the details, and who.

	Two sources, because Kamra records its own amendments in two places: the action log
	(date changes, room moves, agreed rates, instructions) and the document history of
	the reservation (every other edit, one row for each field changed).
	"""
	import json

	start, end = _dates(from_date, to_date)
	params = {"property": property, "a": start, "b": end}
	rows = []

	logs = frappe.db.sql(
		"""
		select l.reference_name as ref, l.actor, l.executed_at as made_on, l.action_type, l.rationale, r.guest_name as guest
		from `tabAgent Action Log` l join `tabReservation` r on r.name = l.reference_name
		where l.reference_doctype = 'Reservation' and l.action_type in %(types)s and r.property = %(property)s
		  and date(l.executed_at) between %(a)s and %(b)s
		""",
		{**params, "types": tuple(LOGGED_AMENDMENTS)}, as_dict=True,
	)
	covered = []  # (booking, time, fields)
	for l in logs:
		covered.append((l["ref"], get_datetime(l["made_on"]), COVERED_BY.get(l["action_type"], set())))
		rows.append({
			"when": str(l["made_on"])[:16], "ref": l["ref"], "guest": l["guest"], "what": _(LOGGED_AMENDMENTS[l["action_type"]]),
			"details": l["rationale"] or "", "changed_by": _full_name(l["actor"]),
		})

	versions = frappe.db.sql(
		"""
		select v.docname as ref, v.owner as by_user, v.creation as made_on, v.data, r.guest_name as guest
		from `tabVersion` v join `tabReservation` r on r.name = v.docname
		where v.ref_doctype = 'Reservation' and r.property = %(property)s and date(v.creation) between %(a)s and %(b)s
		""",
		params, as_dict=True,
	)
	for v in versions:
		try:
			changed = json.loads(v["data"] or "{}").get("changed") or []
		except ValueError:
			continue
		made = get_datetime(v["made_on"])
		skip = set().union(*[f for ref, at, f in covered if ref == v["ref"] and abs((made - at).total_seconds()) <= SAME_CHANGE_SECONDS] or [set()])
		for field, old, new in changed:
			if field not in AMEND_FIELDS or field in skip:
				continue
			label = "Room assigned" if field == "room" and not old else AMEND_FIELDS[field]
			rows.append({
				"when": str(v["made_on"])[:16], "ref": v["ref"], "guest": v["guest"], "what": _(label),
				"details": f"{'(none)' if old in (None, '') else old} → {'(none)' if new in (None, '') else new}",
				"changed_by": _full_name(v["by_user"]),
			})
	return sorted(rows, key=lambda r: r["when"], reverse=True)


def _full_name(user):
	if not user:
		return ""
	return frappe.db.get_value("User", user, "full_name") or user


REPORTS = {
	"arrivals": {
		"title": "Expected arrivals", "fn": arrivals, "range": True, "plan": True,
		"columns": ("ref", "guest", "mobile", "room_type", "room", "packs", "adults", "children", "plan",
		            "nights", "check_in", "check_out", "status", "source", "advance"),
	},
	"departures": {
		"title": "Expected departures", "fn": departures, "range": True, "plan": True,
		"columns": ("ref", "guest", "mobile", "room", "room_type", "packs", "plan", "check_in", "check_out", "status", "amount"),
	},
	"in_house": {
		"title": "In-house guests", "fn": in_house, "range": False, "plan": True,
		"columns": ("room", "guest", "mobile", "packs", "adults", "children", "plan", "check_in", "check_out", "ref"),
	},
	"plan": {
		"title": "Meal plan report", "fn": in_house, "range": False, "plan": True,
		"columns": ("guest", "room", "packs", "adults", "children", "plan", "check_in", "check_out", "ref"),
	},
	"agreed_rates": {
		"title": "Agreed rates by approver", "fn": agreed_rates, "range": True, "approver": True,
		"columns": ("approver", "ref", "guest", "room_type", "check_in", "check_out", "amount", "all_in", "note",
		            "booked_on", "booked_by"),
	},
	"complimentary": {
		"title": "Complimentary stays", "fn": complimentary, "range": True, "approver": True,
		"columns": ("approver", "ref", "guest", "room", "room_type", "packs", "plan", "check_in", "check_out",
		            "reason", "value", "fb_nc", "status"),
	},
	"cancellations": {
		"title": "Cancellations", "fn": cancellations, "range": True,
		"columns": ("ref", "guest", "mobile", "room_type", "check_in", "check_out", "cancelled_on", "cancelled_by",
		            "reason", "note", "cancel_no", "fee", "amount"),
	},
	"amendments": {
		"title": "Amendments", "fn": amendments, "range": True,
		"columns": ("when", "ref", "guest", "what", "details", "changed_by"),
	},
}


def _build(report, property, from_date, to_date, plan, approver):
	spec = REPORTS.get(report)
	if not spec:
		frappe.throw(_("Unknown report."))
	rows = _tidy(spec["fn"](property=property, from_date=from_date, to_date=to_date, plan=plan or None, approver=approver or None))
	start, end = _dates(from_date, to_date if spec["range"] else None)
	when = start if start == end or not spec["range"] else f"{start} to {end}"
	summary = []
	if report in ("in_house", "plan"):
		summary.append(_("{0} rooms, {1} packs").format(len({r["room"] for r in rows if r["room"]}), sum(r["packs"] for r in rows)))
		by_plan = {}
		for r in rows:
			by_plan[r["plan"]] = by_plan.get(r["plan"], 0) + r["packs"]
		if by_plan:
			summary.append(", ".join(f"{k}: {v}" for k, v in sorted(by_plan.items())))
	if report == "complimentary":
		by_who = {}
		for r in rows:
			by_who[r["approver"] or "Not recorded"] = by_who.get(r["approver"] or "Not recorded", 0) + flt(r["value"])
		summary.append(_("{0} stays, value {1}").format(len(rows), f"{sum(by_who.values()):,.2f}"))
		summary.append(", ".join(f"{k}: {v:,.2f}" for k, v in sorted(by_who.items())))
	if report == "agreed_rates":
		by_who = {}
		for r in rows:
			by_who[r["approver"] or "Not recorded"] = by_who.get(r["approver"] or "Not recorded", 0) + 1
		summary.append(", ".join(f"{k}: {v}" for k, v in sorted(by_who.items())) or _("None"))
	return {
		"report": report, "title": _(spec["title"]), "property": property, "when": str(when), "summary": summary,
		"columns": [{"key": k, "label": _(COLUMN[k][0]), "type": COLUMN[k][1]} for k in spec["columns"]],
		"rows": rows,
	}


@frappe.whitelist()
@require_roles(*ROLES)
def catalog(property: str) -> dict:
	"""The reports on offer, which filters each takes, and the choices for those filters."""
	plans = frappe.get_all("Meal Plan", filters={"property": property, "disabled": 0}, pluck="code", order_by="code")
	return {
		"reports": [
			{"key": k, "title": _(v["title"]), "range": v["range"], "plan": bool(v.get("plan")), "approver": bool(v.get("approver"))}
			for k, v in REPORTS.items()
		],
		"plans": ["Room only", *plans],
		"approvers": frappe.get_all("Rate Approver", pluck="name", order_by="name"),
	}


@frappe.whitelist()
@require_roles(*ROLES)
def run(report: str, property: str, from_date: str | None = None, to_date: str | None = None,
        plan: str | None = None, approver: str | None = None) -> dict:
	return _build(report, property, from_date, to_date, plan, approver)


@frappe.whitelist(methods=["GET"])
@require_roles(*ROLES)
def download(report: str, property: str, from_date: str | None = None, to_date: str | None = None,
             plan: str | None = None, approver: str | None = None):
	"""The same report as an Excel file."""
	out = _build(report, property, from_date, to_date, plan, approver)
	subtitle = (f"{frappe.db.get_value('Property', property, 'property_name') or property} · {out['when']}", *out["summary"])
	send_xlsx(
		f"{report.replace('_', '-')}-{out['when'].replace(' to ', '_')}",
		build_xlsx(out["title"], [(c["key"], c["label"]) for c in out["columns"]], out["rows"], subtitle),
	)
