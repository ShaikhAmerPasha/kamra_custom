"""MD Sir and GM Sir may approve complimentary stays; the hotel can change this on the Rate Approver list."""

import frappe


def execute():
	frappe.reload_doc("kamra_custom", "doctype", "rate_approver")
	for name in ("MD Sir", "GM Sir"):
		if frappe.db.exists("Rate Approver", name):
			frappe.db.set_value("Rate Approver", name, "can_approve_complimentary", 1)
