"""The three names every hotel starts with. More are added from the booking screen."""

import frappe

NAMES = ("MD Sir", "GM Sir", "Front Office")


def execute():
	for name in NAMES:
		if not frappe.db.exists("Rate Approver", name):
			frappe.get_doc({"doctype": "Rate Approver", "approver_name": name}).insert(ignore_permissions=True)
