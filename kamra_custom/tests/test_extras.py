"""Extra charges at check-out: GST on top of the amount, all or nothing."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import extras

PROP = "SR Continental"


class TestExtras(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.folio = frappe.db.get_value("Folio", {"property": PROP, "folio_type": "Guest", "status": "Open"})
		if not self.folio:
			self.skipTest("no open guest folio on this site")

	def tearDown(self):
		frappe.db.rollback()

	def test_the_catalog_lists_the_hotels_services_and_the_allowed_rates(self):
		out = extras.catalog(PROP)
		self.assertIn("Airport Pickup", [i["experience_name"] for i in out["items"]])
		self.assertIn(18.0, out["gst_rates"])
		self.assertIn(0.0, out["gst_rates"])

	def test_gst_is_added_on_top_of_the_amount(self):
		before = frappe.db.get_value("Folio", self.folio, "balance")
		out = extras.post_extras(self.folio, [{"description": "Airport drop", "amount": 1000, "gst_rate": 18}])
		self.assertEqual(out["posted"], 1)
		self.assertEqual(out["total"], 1180)
		self.assertAlmostEqual(out["balance"] - float(before), 1180, places=2)
		line = frappe.get_doc("Folio", self.folio).charges[-1]
		self.assertEqual((line.amount, line.gst_rate, line.gst_amount), (1000, 18, 180))
		self.assertEqual(line.description, "Airport drop")

	def test_a_rate_the_country_does_not_allow_is_refused_and_nothing_is_posted(self):
		count = len(frappe.get_doc("Folio", self.folio).charges)
		with self.assertRaises(frappe.ValidationError):
			extras.post_extras(self.folio, [
				{"description": "Laundry", "amount": 300, "gst_rate": 5},
				{"description": "Bad", "amount": 100, "gst_rate": 17},
			])
		self.assertEqual(len(frappe.get_doc("Folio", self.folio).charges), count)

	def test_empty_and_unnamed_charges_are_refused(self):
		with self.assertRaises(frappe.ValidationError):
			extras.post_extras(self.folio, [])
		with self.assertRaises(frappe.ValidationError):
			extras.post_extras(self.folio, [{"description": " ", "amount": 10, "gst_rate": 0}])

	def test_a_zero_amount_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			extras.post_extras(self.folio, [{"description": "Free", "amount": 0, "gst_rate": 0}])
