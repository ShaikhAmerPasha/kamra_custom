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
		or_filters = [["name", "like", like], ["guest_name", "like", like], ["room", "like", like],
		              ["ota_ref", "like", like]]
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
		"guest": res.guest, "phone": frappe.db.get_value("Guest", res.guest, "phone") if res.guest else None,
		"guest_name": res.guest_name, "room": res.room, "room_type": res.room_type,
		"check_in_date": str(res.check_in_date), "check_out_date": str(res.check_out_date),
		"adults": res.adults, "children": res.children, "meal_plan": res.meal_plan,
		"amount_before_tax": res.amount_before_tax, "tax_amount": res.tax_amount,
		"amount_after_tax": res.amount_after_tax, "advance_paid": res.advance_paid,
		"night_rates": [{"date": str(r.stay_date), "rate": r.rate, "gst_rate": r.gst_rate, "meal": r.meal_amount or 0} for r in res.get("night_rates") or []],
		"rate_negotiated": cint_(res.get("rate_negotiated")),
		"negotiated_reason": res.get("negotiated_reason"), "negotiated_by": res.get("negotiated_by"),
		"rate_approved_by": res.get("rate_approved_by"),
		"rate_all_in": cint_(res.get("rate_all_in")),
		"meal_per_night": (res.get("night_rates") or [None])[0].meal_amount if res.get("night_rates") else 0,
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


@frappe.whitelist()
@require_roles("Front Desk", "Night Auditor", "Finance", "Revenue Manager", "Kamra Agent")
def grc_extra(reservation: str) -> dict:
	"""What the registration card needs that Kamra's own card data does not carry.

	staff_name: who checked the guest in; before that, who took the registration card
	step; before that, the user looking at the card.
	signed_on_paper: the guest signed the printed card (no image stored).
	"""
	import json

	doc = frappe.get_doc("Reservation", reservation)
	doc.check_permission("read")

	steps = {}
	try:
		steps = json.loads(doc.get("checkin_steps") or "{}") or {}
	except ValueError:
		steps = {}
	card = steps.get("registration_card") or {}

	user = doc.get("checked_in_by") or card.get("by") or frappe.session.user
	return {
		"staff_name": frappe.db.get_value("User", user, "full_name") or user,
		"signed_on_paper": bool(card.get("state") == "done" and card.get("method") == "paper"),
	}


# --- find a booking to cancel or amend --------------------------------------

FIND_STATUS = {"cancel": ("Confirmed",), "amend": ("Confirmed", "Checked In")}


@frappe.whitelist()
@require_roles("Front Desk", "Kamra Agent")
def find_to_act_on(action: str, property: str, q: str = "", limit: int = 20) -> list[dict]:
	"""Bookings a desk can cancel or amend, found by booking number, guest name or mobile number.

	With nothing typed it lists the next arrivals, so the desk can pick from them.
	"""
	statuses = FIND_STATUS.get(action)
	if not statuses:
		frappe.throw(_("Choose cancel or amend."))
	q = (q or "").strip()
	params = {"property": property, "statuses": statuses, "limit": min(int(limit or 20), 50)}
	where = ""
	if q:
		typed = digits(q)
		clauses = ["r.name like %(like)s", "r.guest_name like %(like)s"]
		params["like"] = f"%{q}%"
		if len(typed) >= 4 and not any(c.isalpha() for c in q):
			clauses.append("g.phone_key = %(key)s or g.phone_key like %(tail)s")
			params["key"] = to_key(q, property_region(property))
			params["tail"] = f"%{typed}"
		where = " and (" + " or ".join(clauses) + ")"
	return frappe.db.sql(
		f"""
		select r.name, r.guest_name, g.phone, r.status, r.check_in_date, r.check_out_date,
		       rt.room_type_name as room_type, ro.room_number as room, r.adults, r.children
		from `tabReservation` r
		left join `tabGuest` g on g.name = r.guest
		left join `tabRoom Type` rt on rt.name = r.room_type
		left join `tabRoom` ro on ro.name = r.room
		where r.property = %(property)s and r.status in %(statuses)s {where}
		order by r.check_in_date, r.guest_name
		limit %(limit)s
		""",  # nosemgrep: frappe-sql-format-injection -- `where` is built from constants; values are parameters
		params, as_dict=True,
	)


# --- the reservation search screen (MyCloud-style) --------------------------

# MyCloud's status choices, as Kamra's statuses.
SEARCH_STATUS = {
	"reserved": ("Confirmed", "Pending Payment", "Requested"),
	"hold": ("Held",),
	"in_house": ("Checked In",),
	"checked_out": ("Checked Out",),
	"cancelled": ("Cancelled",),
	"no_show": ("No Show",),
	"waitlisted": ("Waitlist",),
}
SEARCH_SORT = {
	"name": "guest_name", "arrival": "check_in_date", "departure": "check_out_date",
	"room": "room", "status": "status", "reservation": "name", "created": "creation",
}
SEARCH_FIELDS = [
	"name", "guest", "guest_name", "room", "room_type", "status", "check_in_date",
	"check_out_date", "nights", "adults", "children", "amount_before_tax", "amount_after_tax",
	"advance_paid", "agreed_rate", "ota_ref", "market_segment", "rate_plan", "company",
	"source", "channel", "travel_agent", "group_booking", "booking_type", "is_day_use",
]
SEARCH_SHORTCUTS = ("arrivals_today", "arrivals_3_days", "no_shows_3_days", "multi_room")


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Night Auditor", "Kamra Agent")
def search(
	property: str,
	status: str = "reserved",
	name: str = "",
	date: str = "",
	date_in: str = "arrival",
	phone: str = "",
	market_segment: str = "",
	reservation: str = "",
	room: str = "",
	rate_plan: str = "",
	group_name: str = "",
	guest: str = "",
	room_type: str = "",
	include_accompanying: int = 0,
	shortcut: str = "",
	sort_by: str = "name",
	descending: int = 0,
	limit: int = 200,
) -> dict:
	"""Stays for the search screen: MyCloud's status choices, filters and shortcuts.

	status: reserved, hold, in_house, checked_out, cancelled, no_show, waitlisted or all.
	shortcut: arrivals_today, arrivals_3_days (today and the next 2 nights), no_shows_3_days
	(no-shows whose arrival was in the last 3 days) or multi_room (group bookings).
	Returns {rows, total, truncated}. Each row carries the balance and deposit, who leads a
	group, whether the guest has stayed before and whether other guests travel with them.
	"""
	from kamra.api import _stay_balances
	from kamra.business_date import get_business_date
	from kamra.crs import assert_property_access
	from frappe.utils import add_days, getdate

	assert_property_access(property)
	if shortcut and shortcut not in SEARCH_SHORTCUTS:
		frappe.throw(_("Unknown shortcut."))
	if status != "all" and status not in SEARCH_STATUS:
		frappe.throw(_("Unknown status."))
	limit = max(1, min(int(limit or 200), 500))

	filters: list = [["property", "=", property]]
	today = getdate(get_business_date(property))
	if shortcut == "arrivals_today":
		status = "reserved"
		filters.append(["check_in_date", "=", today])
	elif shortcut == "arrivals_3_days":
		status = "reserved"
		filters.append(["check_in_date", "between", [today, add_days(today, 2)]])
	elif shortcut == "no_shows_3_days":
		status = "no_show"
		filters.append(["check_in_date", "between", [add_days(today, -3), today]])
	elif shortcut == "multi_room":
		filters.append(["group_booking", "is", "set"])
	if status != "all":
		filters.append(["status", "in", list(SEARCH_STATUS[status])])

	if date:
		filters.append([("check_out_date" if date_in == "departure" else "check_in_date"), "=", getdate(date)])
	for field, value in (("market_segment", market_segment), ("room_type", room_type),
	                     ("rate_plan", rate_plan), ("guest", guest)):
		if value:
			filters.append([field, "=", value])
	if reservation:
		# our number, or the id the booking channel gave it
		like = f"%{reservation.strip()}%"
		found = frappe.get_all("Reservation", filters={"property": property},
		                       or_filters=[["name", "like", like], ["ota_ref", "like", like]], pluck="name", limit=1000)
		filters.append(["name", "in", found or ["-"]])
	if room:
		filters.append(["room", "in", frappe.get_all("Room", filters={"property": property, "room_number": ("like", f"%{room.strip()}%")}, pluck="name") or ["-"]])
	if group_name:
		groups = frappe.get_all("Group Booking", filters={"property": property, "group_name": ("like", f"%{group_name.strip()}%")}, pluck="name")
		filters.append(["group_booking", "in", groups or ["-"]])

	or_filters = None
	q = (name or "").strip()
	if q:
		or_filters = [["guest_name", "like", f"%{q}%"]]
		if int(include_accompanying or 0):
			parents = frappe.get_all("Stay Occupant", filters={"full_name": ("like", f"%{q}%"), "parenttype": "Reservation"}, pluck="parent", limit=500)
			if parents:
				or_filters.append(["name", "in", parents])
	if phone:
		key = to_key(phone, property_region(property))
		tail = digits(phone)
		guests = frappe.get_all(
			"Guest", or_filters=[["phone_key", "=", key], ["phone_key", "like", f"%{tail}"]],
			pluck="name", limit=200,
		) if tail else []
		filters.append(["guest", "in", guests or ["-"]])

	field = SEARCH_SORT.get(sort_by, "guest_name")
	order = f"{field} {'desc' if int(descending or 0) else 'asc'}, creation desc"
	total = len(frappe.get_all("Reservation", filters=filters, or_filters=or_filters, pluck="name", limit=100000))
	rows = frappe.get_all("Reservation", filters=filters, or_filters=or_filters, fields=SEARCH_FIELDS,
	                      order_by=order, limit=limit)
	return {"rows": _search_extras(rows, _stay_balances), "total": total, "truncated": total > len(rows)}


def _search_extras(rows: list[dict], balances_of) -> list[dict]:
	"""Add balance, deposit, phone, nationality, group leader, repeater and travelling-with flags."""
	if not rows:
		return rows
	names = [r["name"] for r in rows]
	balances = balances_of(names)
	guests = list({r["guest"] for r in rows if r.get("guest")})
	gmap = {g.name: g for g in frappe.get_all("Guest", filters={"name": ("in", guests)}, fields=["name", "phone", "nationality", "guest_category"])} if guests else {}
	grp_ids = list({r["group_booking"] for r in rows if r.get("group_booking")})
	grp = {g.name: g for g in frappe.get_all("Group Booking", filters={"name": ("in", grp_ids)}, fields=["name", "group_name", "master_reservation"])} if grp_ids else {}
	with_others = set(frappe.get_all("Stay Occupant", filters={"parent": ("in", names), "parenttype": "Reservation"}, pluck="parent"))
	prior = set()
	if guests:
		for g in frappe.db.sql(
			"""select guest, count(*) c from `tabReservation`
			   where guest in %s and status = 'Checked Out' group by guest""", (tuple(guests),), as_dict=True):
			if g.c:
				prior.add(g.guest)
	room_numbers = {r.name: r.room_number for r in frappe.get_all("Room", filters={"name": ("in", list({x["room"] for x in rows if x.get("room")}))}, fields=["name", "room_number"])} if any(x.get("room") for x in rows) else {}
	for r in rows:
		g = gmap.get(r.get("guest")) or {}
		grp_row = grp.get(r.get("group_booking")) or {}
		bal = balances.get(r["name"]) or {}
		nights = int(r.get("nights") or 0) or 1
		r["phone"] = g.get("phone")
		r["nationality"] = g.get("nationality")
		r["guest_class"] = g.get("guest_category")
		r["group_name"] = grp_row.get("group_name")
		r["is_leader"] = bool(grp_row) and grp_row.get("master_reservation") == r["name"]
		r["repeater"] = r.get("guest") in prior
		r["travels_with_others"] = r["name"] in with_others
		r["room_number"] = room_numbers.get(r.get("room"))
		r["room_rate"] = float(r.get("agreed_rate") or 0) or round(float(r.get("amount_before_tax") or 0) / nights, 2)
		r["balance"] = float(bal.get("due") or 0)
		r["deposit"] = float(r.get("advance_paid") or 0)
		for k in ("check_in_date", "check_out_date"):
			r[k] = str(r[k]) if r.get(k) else None
	return rows


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Kamra Agent")
def booking_note(reservation: str) -> dict:
	"""The staff note on a booking ("company pays room only", "cash only"), for the bill and check-out screens.
	Never printed for the guest."""
	from kamra.crs import assert_property_access

	row = frappe.db.get_value("Reservation", reservation, ["property", "internal_remarks"], as_dict=True)
	if not row:
		frappe.throw(_("Reservation not found."))
	assert_property_access(row.property)
	return {"note": (row.internal_remarks or "").strip()}
