"""Schema we add to Kamra, and how it is kept in place.

Everything here is additive and idempotent: it only adds a column and an
index, and running it twice changes nothing. It runs on install and after
every `bench migrate`, so a Kamra upgrade cannot leave it half applied.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

from kamra_custom.card_network import NETWORKS as CARD_NETWORKS

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
	"Folio Payment": [
		{"fieldname": "card_network", "label": "Card Network", "fieldtype": "Select",
		 "options": "\n" + "\n".join(CARD_NETWORKS),
		 "insert_after": "reference", "no_copy": 1, "search_index": 1,
		 "description": "Set when the mode is Card, from the card machine slip."},
		{"fieldname": "card_last4", "label": "Card Last 4 Digits", "fieldtype": "Data", "length": 4,
		 "insert_after": "card_network", "no_copy": 1},
	],
	"POS Order": [
		{"fieldname": "card_network", "label": "Card Network", "fieldtype": "Select",
		 "options": "\n" + "\n".join(CARD_NETWORKS),
		 "insert_after": "payment_mode", "no_copy": 1, "search_index": 1},
		{"fieldname": "card_last4", "label": "Card Last 4 Digits", "fieldtype": "Data", "length": 4,
		 "insert_after": "card_network", "no_copy": 1},
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
		{"fieldname": "kamra_custom_billing_section", "label": "Billing And Analysis", "fieldtype": "Section Break",
		 "insert_after": "complimentary_by", "collapsible": 1},
		{"fieldname": "pay_by", "label": "Pay By", "fieldtype": "Select",
		 "options": "\nCash\nCard\nUPI\nBank transfer\nCompany\nCredit",
		 "insert_after": "kamra_custom_billing_section", "no_copy": 1,
		 "description": "How the guest plans to pay. A note for the desk; payments are still taken on the folio."},
		{"fieldname": "tax_exempt", "label": "Tax Exempt", "fieldtype": "Check",
		 "insert_after": "pay_by", "no_copy": 1,
		 "description": "A note for the desk. Kamra's tax on the bill is not changed by it."},
		{"fieldname": "gst_number", "label": "GST Number", "fieldtype": "Data", "length": 15,
		 "insert_after": "tax_exempt", "no_copy": 1},
		{"fieldname": "pan_number", "label": "PAN Number", "fieldtype": "Data", "length": 10,
		 "insert_after": "gst_number", "no_copy": 1},
		{"fieldname": "credit_limit", "label": "Credit Limit", "fieldtype": "Currency",
		 "insert_after": "pan_number", "no_copy": 1},
		{"fieldname": "guaranteed", "label": "Guaranteed", "fieldtype": "Check",
		 "insert_after": "credit_limit", "no_copy": 1, "search_index": 1,
		 "description": "The room is held for the guest whatever the arrival time."},
		{"fieldname": "special_guest", "label": "Special Guest", "fieldtype": "Check",
		 "insert_after": "guaranteed", "no_copy": 1, "search_index": 1},
		{"fieldname": "business_source", "label": "Business Source", "fieldtype": "Data",
		 "insert_after": "special_guest", "no_copy": 1},
		{"fieldname": "domicile", "label": "Domicile", "fieldtype": "Link", "options": "Country",
		 "insert_after": "business_source", "no_copy": 1},
		{"fieldname": "folio_routes", "label": "Folio Routing Rules", "fieldtype": "Long Text",
		 "insert_after": "domicile", "no_copy": 1, "read_only": 1,
		 "description": "JSON list of {charge_type, target, date_from, date_to}. Set by Kamra Custom; applied with Kamra's own folio transfer."},
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


# Starting passwords for staff the setup app creates. Set once, only while the
# user has no password, so a password the user chose is never overwritten.
INITIAL_PASSWORDS = {"kavita@srcontinental.com": "123"}


def set_initial_passwords():
	from frappe.utils.password import update_password

	for user, password in INITIAL_PASSWORDS.items():
		has_password = frappe.db.exists("__Auth", {"doctype": "User", "name": user, "fieldname": "password"})
		if frappe.db.exists("User", user) and not has_password:
			update_password(user, password)  # skips the strength rule, unlike the form


def ensure_standard_times():
	"""Standard check-in 2 PM and check-out 12 PM.

	A property still on the times the demo data carries (12:00 in, 11:00 out) is moved to the
	hotel's times. One the hotel has set to anything else is left alone.
	"""
	for name in frappe.get_all("Property", pluck="name"):
		cur = frappe.db.get_value("Property", name, ["checkin_time", "checkout_time"], as_dict=True)
		if (str(cur.checkin_time)[:5], str(cur.checkout_time)[:5]) in (("12:00", "11:00"), ("None", "None"), ("", "")):
			frappe.db.set_value("Property", name, {"checkin_time": "14:00:00", "checkout_time": "12:00:00"})


def after_migrate():
	from kamra_custom.guests import backfill_phone_keys

	ensure_standard_times()
	ensure_schema()
	set_initial_passwords()
	backfill_phone_keys()  # guests added while this app was missing
