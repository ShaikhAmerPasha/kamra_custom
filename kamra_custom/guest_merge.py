"""Find guest profiles that are the same person, and merge them into one.

Duplicates come from bookings made without a phone number or without picking the guest who is already on
file. Kamra has no way to join them afterwards. This uses Frappe's own merge (`rename_doc(..., merge=True)`),
which points every link to the removed profile (bookings, folios, payments, ID documents, notes) at the one
kept and then deletes the removed profile. It cannot be undone, so it needs a reason, refuses profiles whose
phone numbers differ or that are in house, and writes what it did on the kept profile.
"""

import frappe
from frappe import _
from kamra.authz import guest_scope_sql, require_roles

ROLES = ("Hotel Admin", "Front Desk")
SHOWN = 20
FILL = ("phone", "email", "nationality", "id_type", "id_number", "id_place_of_issue", "id_issue_date",
        "id_expiry_date", "address_line", "city", "date_of_birth", "gender", "photo", "id_file",
        "address_proof_file", "guest_notes")


def _key(name: str) -> str:
	return " ".join((name or "").lower().split())


def _members(names: list[str]) -> list[dict]:
	rows = frappe.get_all("Guest", filters={"name": ("in", names)},
	                      fields=["name", "full_name", "phone", "email", "vip", "blacklisted", "creation", "phone_key"])
	stats = {r.guest: r for r in frappe.db.sql(
		"""SELECT guest, COUNT(*) AS stays, MAX(check_out_date) AS last_stay
		   FROM `tabReservation` WHERE guest IN %(g)s GROUP BY guest""", {"g": names}, as_dict=True)}
	out = []
	for r in rows:
		s = stats.get(r.name)
		out.append({"name": r.name, "full_name": r.full_name, "phone": r.phone or "", "email": r.email or "",
		            "vip": int(r.vip or 0), "blacklisted": int(r.blacklisted or 0), "phone_key": r.phone_key or "",
		            "stays": int(s.stays) if s else 0, "last_stay": str(s.last_stay) if s and s.last_stay else "",
		            "created": str(r.creation)})
	return out


def _best(members: list[dict]) -> str:
	"""The profile to keep: most stays, then one with a phone, then the oldest."""
	return sorted(members, key=lambda m: (-m["stays"], not m["phone"], m["created"]))[0]["name"]


def _blocked(members: list[dict]) -> str:
	keys = {m["phone_key"] for m in members if m["phone_key"] and m["phone_key"] != "-"}
	if len(keys) > 1:
		return _("They have different phone numbers, so they may be different people.")
	return ""


@frappe.whitelist()
@require_roles(*ROLES)
def duplicates(property: str | None = None) -> list[dict]:
	"""Groups of guest profiles with the same name (ignoring case and extra spaces), the biggest first."""
	scope_sql, params = guest_scope_sql("g")
	rows = frappe.db.sql(  # nosemgrep: frappe-sql-format-injection -- the scope clause is a constant built by Kamra
		f"SELECT g.name, g.full_name FROM `tabGuest` g WHERE g.full_name IS NOT NULL AND g.full_name != '' AND {scope_sql}",
		params, as_dict=True)
	groups: dict[str, list[str]] = {}
	for r in rows:
		groups.setdefault(_key(r.full_name), []).append(r.name)
	out = []
	for names in (v for v in groups.values() if len(v) > 1):
		members = _members(names)
		blocked = _blocked(members)
		out.append({"members": members, "keep": _best(members), "can_merge": not blocked, "blocked": blocked})
	out.sort(key=lambda g: (-len(g["members"]), g["members"][0]["full_name"].lower()))
	return out[:SHOWN]


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def merge(keep: str, remove: str, reason: str) -> dict:
	"""Point everything that belongs to `remove` at `keep`, fill what `keep` lacks, and delete `remove`."""
	reason = (reason or "").strip()
	if not reason:
		frappe.throw(_("Say why these two profiles are the same person."))
	if keep == remove:
		frappe.throw(_("Pick two different profiles."))
	for n in (keep, remove):
		if not frappe.db.exists("Guest", n):
			frappe.throw(_("Guest {0} no longer exists.").format(n))
	members = _members([keep, remove])
	blocked = _blocked(members)
	if blocked:
		frappe.throw(blocked)
	if frappe.db.exists("Reservation", {"guest": remove, "status": "Checked In"}):
		frappe.throw(_("{0} is in house now. Merge after check-out.").format(remove))

	k, r = frappe.get_doc("Guest", keep), frappe.get_doc("Guest", remove)
	for f in FILL:
		if r.get(f) and not k.get(f):
			k.set(f, r.get(f))
	if r.vip:
		k.vip = 1
	if r.blacklisted:
		k.blacklisted = 1
		reasons = [x for x in (k.blacklist_reason, r.blacklist_reason) if x]
		k.blacklist_reason = " | ".join(dict.fromkeys(reasons))
	moved = frappe.db.count("Reservation", {"guest": remove})
	removed_name = r.full_name
	k.save(ignore_permissions=True)
	frappe.rename_doc("Guest", remove, keep, merge=True, force=True)
	frappe.get_doc({
		"doctype": "Comment", "comment_type": "Info", "reference_doctype": "Guest", "reference_name": keep,
		"content": f"Merged guest {remove} ({removed_name}) into this profile: {reason}. {moved} booking(s) moved.",
	}).insert(ignore_permissions=True)
	return {"kept": keep, "removed": remove, "bookings_moved": moved}
