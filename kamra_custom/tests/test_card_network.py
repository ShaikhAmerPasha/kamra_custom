"""Card network on card payments (kamra_custom.card_network)."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import card_network as cn

PROP = "SR Continental"


class TestCardNetwork(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		frappe.local.form_dict = frappe._dict()

	def tearDown(self):
		frappe.local.form_dict = frappe._dict()

	def test_no_network_in_the_request_means_nothing_is_recorded(self):
		self.assertEqual(cn.clean("", ""), (None, None))
		self.assertEqual(cn.clean(None, "1234"), (None, None))

	def test_a_known_network_with_four_digits_is_accepted(self):
		self.assertEqual(cn.clean("RuPay", "4321"), ("RuPay", "4321"))
		self.assertEqual(cn.clean("Visa", ""), ("Visa", None))

	def test_an_unknown_network_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			cn.clean("Bitcoin", "")

	def test_anything_but_four_digits_is_refused(self):
		for bad in ("123", "12345", "12a4", "4111 1111 1111 1111"):
			with self.assertRaises(frappe.ValidationError):
				cn.clean("Visa", bad)

	def test_the_choices_match_the_field_options(self):
		options = frappe.get_meta("Folio Payment").get_field("card_network").options.split("\n")
		self.assertEqual([o for o in options if o], cn.NETWORKS)
		self.assertEqual(
			[o for o in frappe.get_meta("POS Order").get_field("card_network").options.split("\n") if o],
			cn.NETWORKS,
		)

	def _folio_with(self, mode):
		doc = frappe.new_doc("Folio")
		doc.append("payments", {"mode": mode, "amount": 100})
		return doc

	def test_a_new_card_line_gets_the_network_from_the_request(self):
		frappe.local.form_dict = frappe._dict(card_network="American Express", card_last4="0005")
		doc = self._folio_with("Card")
		cn.on_folio_save(doc)
		row = doc.payments[0]
		self.assertEqual((row.card_network, row.card_last4), ("American Express", "0005"))

	def test_a_cash_line_never_gets_a_network(self):
		frappe.local.form_dict = frappe._dict(card_network="Visa")
		doc = self._folio_with("Cash")
		cn.on_folio_save(doc)
		self.assertFalse(doc.payments[0].card_network)

	def test_the_report_has_a_card_split(self):
		from kamra_custom import cashier

		out = cashier.collections(PROP)
		self.assertIn("by_card_network", out)
		for row in out["by_card_network"]:
			self.assertEqual(set(row), {"network", "amount", "lines"})

	def test_the_house_screen_carries_the_card_split(self):
		from kamra_custom import house

		self.assertIn("by_card_network", house.house_today(PROP)["collected"])
