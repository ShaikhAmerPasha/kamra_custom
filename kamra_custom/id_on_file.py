"""One rule for "this stay has an ID on file", shared by the desk list and Needs attention.

It matches the check-in screen: a scanned document on the reservation, or an ID number or
file on the guest profile, counts. Without this the list said "ID missing" for a guest whose
ID number had just been typed at the booking.
"""

import frappe


def guests_with_id(guests) -> set:
	"""Names of the given guest profiles that hold an ID number or file."""
	guests = [g for g in set(guests) if g]
	if not guests:
		return set()
	rows = frappe.get_all("Guest", filters={"name": ("in", guests)}, fields=["name", "id_number", "id_file"])
	return {r.name for r in rows if r.id_number or r.id_file}


def id_missing(reservation, guests_ok: set) -> bool:
	"""True when neither the reservation nor the guest profile holds an ID."""
	if reservation.get("id_document") or reservation.get("id_document_discarded"):
		return False
	return reservation.get("guest") not in guests_ok
