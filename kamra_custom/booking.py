"""One call to book a stay: the guest, one or more rooms, remarks, agreed rates
and an advance. Everything happens in a single request, so a failure on any room
leaves nothing behind.

Kamra's `create_group_booking` drops the guest profile, remarks and extras for
multi-room stays, and `create_booking` stores its "special requests" where no
screen reads them. This function calls Kamra's `create_booking` for each room
(so every rule Kamra has still applies) and carries the shared details itself.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from kamra.authz import require_roles
from kamra_custom import negotiation
from kamra_custom.guests import property_region
from kamra_custom.phone import to_key

MAX_ROOMS = 20


def find_guest_by_phone(phone: str | None, property: str) -> str | None:
	"""The guest whose number is this one, however it was typed."""
	key = to_key(phone, property_region(property))
	if not key or not frappe.get_meta("Guest").has_field("phone_key"):
		return None
	return frappe.db.get_value("Guest", {"phone_key": key}, "name", order_by="modified desc")


def _room_specs(rooms) -> list[dict]:
	rooms = frappe.parse_json(rooms) if isinstance(rooms, str) else rooms
	if not rooms:
		frappe.throw(_("Add at least one room."))
	if len(rooms) > MAX_ROOMS:
		frappe.throw(_("At most {0} rooms in one booking.").format(MAX_ROOMS))
	out = []
	for i, r in enumerate(rooms, 1):
		if not r.get("room_type"):
			frappe.throw(_("Room {0}: choose a room type.").format(i))
		adults, children = cint(r.get("adults", 2)), cint(r.get("children", 0))
		if adults < 1:
			frappe.throw(_("Room {0}: at least one adult.").format(i))
		if children < 0:
			frappe.throw(_("Room {0}: children cannot be negative.").format(i))
		out.append({**r, "adults": adults, "children": children})
	return out


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Kamra Agent")
def create_stay(
	property: str,
	guest_name: str,
	check_in_date: str,
	check_out_date: str,
	rooms,
	phone: str | None = None,
	guest: str | None = None,
	check_in_time: str | None = None,
	check_out_time: str | None = None,
	source: str = "Manual",
	company: str | None = None,
	travel_agent: str | None = None,
	booking_instructions: str | None = None,
	internal_remarks: str | None = None,
	booking_ref: str | None = None,
	advance_amount: float = 0,
	advance_mode: str = "Cash",
	advance_reference: str | None = None,
	pin: str | None = None,
) -> dict:
	"""Book one or more rooms for one guest.

	Each entry of `rooms`: {room_type, adults, children, meal_plan, rates, reason}.
	`rates` is an optional list with one agreed nightly rate per night.
	"""
	from kamra.api import create_booking, record_advance
	from kamra.crs import assert_property_access

	assert_property_access(property)
	specs = _room_specs(rooms)
	guest = guest or find_guest_by_phone(phone, property)
	instructions = (booking_instructions or "").strip()
	remarks = (internal_remarks or "").strip()

	group = None
	if len(specs) > 1:
		group = frappe.get_doc({
			"doctype": "Group Booking", "property": property,
			"group_name": f"{guest_name} · {len(specs)} rooms",
			"company": company or None,
			"check_in_date": check_in_date, "check_out_date": check_out_date,
			"status": "Confirmed",
		}).insert()

	made = []
	for i, spec in enumerate(specs, 1):
		try:
			res = create_booking(
				property=property,
				room_type=spec["room_type"],
				check_in_date=check_in_date,
				check_out_date=check_out_date,
				guest_name=guest_name,
				phone=phone,
				adults=spec["adults"],
				children=spec["children"],
				meal_plan=spec.get("meal_plan") or None,
				booking_type=("Corporate" if company else "Group") if group else ("Corporate" if company else "Individual"),
				company=company or None,
				group_booking=group.name if group else None,
				source=source or "Manual",
				travel_agent=travel_agent or None,
				guest=guest,
				check_in_time=check_in_time,
				check_out_time=check_out_time,
				over_capacity_reason=spec.get("over_capacity_reason") or None,
				over_capacity_guests=cint(spec.get("over_capacity_guests", 0)),
				over_capacity_charge=flt(spec.get("over_capacity_charge", 0)),
			)
		except Exception as e:
			# say which room, then let the request roll everything back
			frappe.throw(_("Room {0} could not be booked: {1}").format(i, frappe.safe_decode(str(e))))
		name = res["reservation"]
		# every room of the stay belongs to the same guest profile
		guest = guest or frappe.db.get_value("Reservation", name, "guest")

		doc = frappe.get_doc("Reservation", name)
		changed = False
		if instructions:
			doc.special_requests = instructions
			changed = True
		if remarks:
			doc.internal_remarks = remarks
			changed = True
		if booking_ref:
			doc.ota_ref = booking_ref.strip()
			changed = True
		outcome = None
		if spec.get("rates"):
			outcome = negotiation.apply_rates(doc, spec["rates"], spec.get("reason") or "")
			changed = True
		if changed:
			doc.save()
		if outcome:
			negotiation.log_change(doc, outcome, spec.get("reason") or "")
		made.append({
			"reservation": name, "room": doc.room, "room_type": doc.room_type,
			"amount_after_tax": doc.amount_after_tax, "negotiated": bool(outcome),
		})

	advance = None
	if flt(advance_amount) > 0:
		record_advance(made[0]["reservation"], flt(advance_amount), advance_mode, advance_reference, pin)
		advance = {"reservation": made[0]["reservation"], "amount": flt(advance_amount), "mode": advance_mode}

	return {
		"group_booking": group.name if group else None,
		"guest": guest,
		"reservations": made,
		"total": sum(m["amount_after_tax"] or 0 for m in made),
		"advance": advance,
	}
