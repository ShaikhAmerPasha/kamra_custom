"""Room assigned at check-in, and check-in only to a clean room.

Two switches in Kamra Custom Settings, both off until the hotel turns them on:

* `assign_room_at_checkin`: a new reservation holds a room type, not a room. The
  room is chosen in the check-in steps. It applies to every way a reservation is
  made (the desk, a group, the booking page, a channel manager), because it is
  done where the reservation is inserted. A walk-in keeps its room: the guest is
  at the desk and the room is chosen now. Kamra's capacity check still counts the
  stay against the room type, so the hotel cannot sell more than it has.
* `clean_rooms_only`: the guest cannot be checked in to a room that is not clean.
"""

import frappe
from frappe import _

CLEAN = ("Clean", "Inspected", "Ready")


def is_on(switch: str, default: bool = False) -> bool:
	"""A switch in Kamra Custom Settings. One never saved has no stored value, so `default` stands."""
	row = frappe.db.sql("select value from `tabSingles` where doctype = %s and field = %s", ("Kamra Custom Settings", switch))
	value = row[0][0] if row else None
	return default if value in (None, "") else bool(int(value))


def release_room(doc, method=None):
	"""Reservation.before_insert: a new reservation does not hold a room yet."""
	if not is_on("assign_room_at_checkin"):
		return
	if doc.room and doc.source != "Walk-in" and doc.status not in ("Checked In", "Checked Out"):
		doc.room = None


def require_clean_room(doc, method=None):
	"""Reservation.validate: a guest checks in to a clean room only."""
	if doc.status != "Checked In" or not doc.room or not is_on("clean_rooms_only"):
		return
	before = doc.get_doc_before_save()
	if before and before.status == "Checked In" and before.room == doc.room:
		return
	state = frappe.db.get_value("Room", doc.room, "housekeeping_status")
	if state not in CLEAN:
		number = frappe.db.get_value("Room", doc.room, "room_number") or doc.room
		frappe.throw(
			_("Room {0} is {1}, not clean yet. Choose a clean room, or ask housekeeping to clean it first.").format(
				number, _(state or "not ready")
			)
		)
