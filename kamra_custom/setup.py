"""Schema we add to Kamra, and how it is kept in place.

Everything here is additive and idempotent: it only adds a column and an
index, and running it twice changes nothing. It runs on install and after
every `bench migrate`, so a Kamra upgrade cannot leave it half applied.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

CUSTOM_FIELDS = {
	"Guest": [
		{
			"fieldname": "phone_key",
			"label": "Phone Key",
			"fieldtype": "Data",
			"insert_after": "phone",
			"read_only": 1,
			"hidden": 1,
			"search_index": 1,
			"no_copy": 1,
			"print_hide": 1,
			"report_hide": 1,
			"description": "Digits of the phone number in international form. Set by Kamra Custom.",
		}
	],
	"Reservation": [
		{"fieldname": "kamra_custom_section", "label": "Kamra Custom", "fieldtype": "Section Break",
		 "insert_after": "special_requests", "collapsible": 1},
		{"fieldname": "internal_remarks", "label": "Internal Remarks", "fieldtype": "Small Text",
		 "insert_after": "kamra_custom_section", "no_copy": 1,
		 "description": "For staff only. Never printed on an invoice or registration card."},
		{"fieldname": "rate_negotiated", "label": "Rate Negotiated", "fieldtype": "Check",
		 "insert_after": "internal_remarks", "read_only": 1, "no_copy": 1},
		{"fieldname": "rack_amount_before_tax", "label": "System Amount Before Tax", "fieldtype": "Currency",
		 "insert_after": "rate_negotiated", "read_only": 1, "no_copy": 1},
		{"fieldname": "negotiated_by", "label": "Rate Agreed By", "fieldtype": "Link", "options": "User",
		 "insert_after": "rack_amount_before_tax", "read_only": 1, "no_copy": 1},
		{"fieldname": "negotiated_reason", "label": "Reason For Discount", "fieldtype": "Small Text",
		 "insert_after": "negotiated_by", "read_only": 1, "no_copy": 1},
		{"fieldname": "rate_all_in", "label": "Agreed Rate Includes Meal", "fieldtype": "Check",
		 "insert_after": "negotiated_reason", "read_only": 1, "no_copy": 1,
		 "description": "The agreed nightly rate covers room and meal together."},
		{"fieldname": "is_complimentary", "label": "Complimentary Stay", "fieldtype": "Check",
		 "insert_after": "rate_approved_by", "read_only": 1, "no_copy": 1, "search_index": 1,
		 "description": "Room and meal are free. Set from the check-in steps with an approver."},
		{"fieldname": "complimentary_approver", "label": "Complimentary Approved By", "fieldtype": "Link",
		 "options": "Rate Approver", "insert_after": "is_complimentary", "read_only": 1, "no_copy": 1},
		{"fieldname": "complimentary_reason", "label": "Complimentary Reason", "fieldtype": "Small Text",
		 "insert_after": "complimentary_approver", "read_only": 1, "no_copy": 1},
		{"fieldname": "complimentary_value", "label": "Complimentary Value (with tax)", "fieldtype": "Currency",
		 "insert_after": "complimentary_reason", "read_only": 1, "no_copy": 1,
		 "description": "What the room and meal would have cost at the system rate."},
		{"fieldname": "complimentary_by", "label": "Complimentary Marked By", "fieldtype": "Link", "options": "User",
		 "insert_after": "complimentary_value", "read_only": 1, "no_copy": 1},
		{"fieldname": "rate_approved_by", "label": "Rate Approved By", "fieldtype": "Link", "options": "Rate Approver",
		 "insert_after": "negotiated_reason", "read_only": 1, "no_copy": 1, "search_index": 1},
	],
}


def ensure_schema():
	create_custom_fields(CUSTOM_FIELDS, update=True)
	_ensure_reservation_guest_index()


def _ensure_reservation_guest_index():
	"""Visit counts read Reservation by guest; Kamra does not index it."""
	make_property_setter("Reservation", "guest", "search_index", 1, "Check", for_doctype=False)
	if not frappe.db.has_index("tabReservation", "guest"):
		frappe.db.add_index("Reservation", ["guest"], index_name="guest")


def after_install():
	after_migrate()


def after_migrate():
	from kamra_custom.guests import backfill_phone_keys

	ensure_schema()
	backfill_phone_keys()  # guests added while this app was missing
