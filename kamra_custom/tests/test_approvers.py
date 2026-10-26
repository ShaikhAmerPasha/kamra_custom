"""Phase 2: who approved a lower rate."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import approvers, negotiation

PROP = "SR Continental"
RT = "SR Continental-DLX"


class TestApprovers(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def test_the_three_starting_names_exist(self):
		names = approvers.list_approvers()["approvers"]
		for n in ("MD Sir", "GM Sir", "Front Office"):
			self.assertIn(n, names)

	def test_a_manager_can_add_a_name_and_it_is_listed(self):
		out = approvers.create_approver("  Owner   Madam ")
		self.assertEqual(out["name"], "Owner Madam")
		self.assertIn("Owner Madam", approvers.list_approvers()["approvers"])

	def test_adding_the_same_name_twice_gives_one_row_and_re_enables_it(self):
		approvers.create_approver("Owner Madam")
		frappe.db.set_value("Rate Approver", "Owner Madam", "disabled", 1)
		approvers.create_approver("Owner Madam")
		self.assertEqual(frappe.db.count("Rate Approver", {"approver_name": "Owner Madam"}), 1)
		self.assertEqual(frappe.db.get_value("Rate Approver", "Owner Madam", "disabled"), 0)

	def test_a_desk_user_can_pick_but_not_add(self):
		from kamra.tests.fixtures import ensure_roles_and_users

		ensure_roles_and_users()
		frappe.set_user("banquet.sales@test.local")
		self.assertFalse(approvers.can_create())
		with self.assertRaises(frappe.PermissionError):
			approvers.create_approver("Sneaky Sir")

	def test_name_length_is_checked(self):
		for bad in ("", "A", "x" * 41):
			with self.assertRaises(frappe.ValidationError):
				approvers.create_approver(bad)

	def test_check_approver_accepts_enabled_names_only(self):
		self.assertEqual(approvers.check_approver(" MD   Sir "), "MD Sir")
		for bad in (None, "", "Nobody"):
			with self.assertRaises(frappe.ValidationError):
				approvers.check_approver(bad)

	def test_the_reservation_field_exists_and_links_to_the_list(self):
		field = frappe.get_meta("Reservation").get_field("rate_approved_by")
		self.assertEqual((field.fieldtype, field.options), ("Link", "Rate Approver"))
