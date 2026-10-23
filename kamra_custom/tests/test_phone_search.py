"""Phase 4: one key per phone number, and search by number or name."""

import unittest

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom.phone import digits, to_key


class TestPhoneKey(unittest.TestCase):
	def test_every_way_of_writing_one_indian_number_gives_one_key(self):
		for raw in ("+91 98765 43210", "+919876543210", "098765 43210", "9876543210",
		            "98765-43210", "0091 98765 43210", "(+91) 9876543210"):
			self.assertEqual(to_key(raw, "IN"), "919876543210", raw)

	def test_other_countries(self):
		self.assertEqual(to_key("050 123 4567", "AE"), "971501234567")
		self.assertEqual(to_key("+971 50 123 4567", "AE"), "971501234567")
		self.assertEqual(to_key("(202) 555-0143", "US"), "12025550143")

	def test_a_plus_number_ignores_the_property_country(self):
		self.assertEqual(to_key("+44 20 7946 0958", "IN"), "442079460958")

	def test_unreadable_number_keeps_its_digits(self):
		self.assertEqual(to_key("12-34", "IN"), "1234")

	def test_empty(self):
		self.assertEqual(to_key("", "IN"), "")
		self.assertEqual(to_key(None, "IN"), "")
		self.assertEqual(to_key("n/a", "IN"), "")

	def test_digits(self):
		self.assertEqual(digits("+91 (98765) 43-210"), "919876543210")


class TestSchema(IntegrationTestCase):
	def test_guest_has_an_indexed_key_column(self):
		self.assertTrue(frappe.get_meta("Guest").has_field("phone_key"))
		self.assertTrue(frappe.db.has_index("tabGuest", "phone_key_index"))

	def test_reservation_guest_is_indexed(self):
		self.assertTrue(frappe.db.has_index("tabReservation", "guest"))

	def test_setup_can_run_twice(self):
		from kamra_custom import setup

		setup.ensure_schema()
		setup.ensure_schema()
		self.assertEqual(
			frappe.db.count("Custom Field", {"dt": "Guest", "fieldname": "phone_key"}), 1
		)


class TestSearch(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.prop = frappe.db.get_value("Property", {}, "name")
		if not self.prop:
			self.skipTest("no property on this site")

	def _guest(self, first, phone):
		return frappe.get_doc({"doctype": "Guest", "first_name": first, "phone": phone}).insert(ignore_permissions=True)

	def test_saving_a_guest_sets_the_key(self):
		g = self._guest("KeyTest", "+91 90000 99999")
		self.assertEqual(frappe.db.get_value("Guest", g.name, "phone_key"), "919000099999")

	def test_changing_the_phone_changes_the_key(self):
		g = self._guest("KeyMove", "9000088888")
		g.phone = "9000077777"
		g.save(ignore_permissions=True)
		self.assertEqual(frappe.db.get_value("Guest", g.name, "phone_key"), "919000077777")

	def test_finds_the_guest_however_the_number_is_typed(self):
		from kamra_custom.guests import search

		g = self._guest("Findme", "+91 90000 55555")
		for q in ("9000055555", "09000055555", "+919000055555", "90000 55555"):
			self.assertIn(g.name, [r["name"] for r in search(q, self.prop)], q)

	def test_finds_by_the_last_digits(self):
		from kamra_custom.guests import search

		g = self._guest("Tailguy", "9000044321")
		self.assertIn(g.name, [r["name"] for r in search("4321", self.prop)])

	def test_too_few_digits_finds_nothing(self):
		from kamra_custom.guests import search

		self.assertEqual(search("432", self.prop), [])

	def test_still_finds_by_name(self):
		from kamra_custom.guests import search

		g = self._guest("Zyxwv", "9000033333")
		self.assertIn(g.name, [r["name"] for r in search("Zyxw", self.prop)])

	def test_result_says_how_often_the_guest_stayed(self):
		from kamra_custom.guests import search

		rows = search("9000000011", self.prop)  # the site's own "Charge Test"
		if not rows:
			self.skipTest("seed guest not on this site")
		self.assertTrue({"name", "full_name", "phone", "stays", "last_stay", "vip", "blacklisted"} <= set(rows[0]))
		self.assertGreaterEqual(rows[0]["stays"], 0)

	def test_kamra_own_guest_search_still_works(self):
		from kamra.api import guest_search

		g = self._guest("Regress", "9000022222")
		self.assertIn(g.name, [r["name"] for r in guest_search("Regress")])
