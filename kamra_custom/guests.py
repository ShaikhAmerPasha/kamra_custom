"""Find a guest by mobile number or name, and keep one key per number."""

import frappe

from kamra.authz import guest_scope_sql, require_roles
from kamra_custom.phone import digits, to_key

MIN_DIGITS = 4  # fewer digits match too many people to be useful


def property_region(property: str | None) -> str | None:
	"""ISO country code of a property, to read numbers typed without +code."""
	if not property:
		return None
	country = frappe.db.get_value("Property", property, "country")
	code = frappe.db.get_value("Country", country, "code") if country else None
	return code.upper() if code else None


# --- keeping the key up to date ---------------------------------------------

def set_phone_key(doc, method=None):
	"""Guest before_save: the key follows the phone number."""
	if doc.meta.has_field("phone_key"):
		doc.phone_key = to_key(doc.phone, _default_region())


def _default_region() -> str | None:
	prop = frappe.db.get_value("Property", {}, "name", order_by="creation asc")
	return property_region(prop)


def backfill_phone_keys(batch: int = 500) -> int:
	"""Give every existing guest a key. Safe to run again."""
	if not frappe.get_meta("Guest").has_field("phone_key"):
		return 0
	region = _default_region()
	done = 0
	while True:
		rows = frappe.get_all(
			"Guest",
			filters={"phone": ("is", "set"), "phone_key": ("is", "not set")},
			fields=["name", "phone"],
			limit=batch,
		)
		if not rows:
			break
		for r in rows:
			key = to_key(r.phone, region)
			# a number with no digits still needs a value, or this loop never ends
			frappe.db.set_value("Guest", r.name, "phone_key", key or "-", update_modified=False)
			done += 1
		frappe.db.commit()
	return done


# --- search -----------------------------------------------------------------

@frappe.whitelist()
@require_roles("Front Desk", "Kamra Agent")
def search(q: str, property: str | None = None, limit: int = 8) -> list[dict]:
	"""Guests matching a phone number or a name, with how often they stayed.

	A full number is an exact lookup on the indexed key. A few digits match the
	end of a number. Visits are counted only for the guests found.
	"""
	q = (q or "").strip()
	typed = digits(q)
	by_phone = len(typed) >= MIN_DIGITS and not any(c.isalpha() for c in q)
	if not by_phone and len(q) < 2:
		return []

	scope_sql, params = guest_scope_sql("g")
	params["limit"] = int(limit or 8)
	if by_phone:
		key = to_key(q, property_region(property))
		params["key"] = key
		params["tail"] = f"%{typed}"
		match = "(g.phone_key = %(key)s OR g.phone_key LIKE %(tail)s)"
	else:
		params["name"] = f"%{q}%"
		match = "g.full_name LIKE %(name)s"

	guests = frappe.db.sql(  # nosemgrep: frappe-sql-format-injection -- values are parameterized; `match` and the scope clause are constants
		f"""
		SELECT g.name, g.full_name, g.phone, g.email, g.nationality, g.vip,
		       g.blacklisted, g.blacklist_reason
		FROM `tabGuest` g
		WHERE {match} AND {scope_sql}
		ORDER BY g.modified DESC
		LIMIT %(limit)s
		""",
		params,
		as_dict=True,
	)
	if not guests:
		return []

	stats = {
		r.guest: r
		for r in frappe.db.sql(
			"""
			SELECT guest, COUNT(*) AS stays, MAX(check_in_date) AS last_stay
			FROM `tabReservation`
			WHERE guest IN %(names)s AND status IN ('Checked In', 'Checked Out')
			GROUP BY guest
			""",
			{"names": tuple(g.name for g in guests)},
			as_dict=True,
		)
	}
	for g in guests:
		s = stats.get(g.name)
		g["stays"] = int(s.stays) if s else 0
		g["last_stay"] = str(s.last_stay) if s else None
	guests.sort(key=lambda g: (-g["stays"], g["full_name"] or ""))
	return guests
