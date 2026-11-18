"""Collections on a day: by payment mode and by cashier."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import nowdate

from kamra_custom import attention, cashier

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestCollections(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

	def folio(self):
		return frappe.db.get_value("Folio", {"property": PROP, "folio_type": "Guest", "status": "Open"})

	def test_totals_group_by_mode_and_cashier(self):
		from kamra.api import add_folio_payment

		f = self.folio()
		if not f:
			self.skipTest("no open guest folio on this site")
		before = cashier.collections(PROP)
		add_folio_payment(f, "Cash", 1000, reference="T-1")
		add_folio_payment(f, "UPI", 500, reference="T-2")
		after = cashier.collections(PROP)
		get = lambda out, mode: next((m["amount"] for m in out["by_mode"] if m["mode"] == mode), 0)  # noqa: E731
		self.assertEqual(get(after, "Cash") - get(before, "Cash"), 1000)
		self.assertEqual(get(after, "UPI") - get(before, "UPI"), 500)
		self.assertEqual(round(after["total"] - before["total"], 2), 1500)
		self.assertEqual(after["cash"] - before["cash"], 1000)
		self.assertTrue(any(c["cashier"] == "Administrator" for c in after["by_cashier"]))

	def test_total_is_the_sum_of_the_modes(self):
		out = cashier.collections(PROP)
		self.assertEqual(out["total"], round(sum(m["amount"] for m in out["by_mode"]), 2))

	def test_a_late_night_audit_is_listed(self):
		frappe.db.set_value("Property", PROP, "business_date", frappe.utils.add_days(nowdate(), -3))
		g = next((x for x in attention.attention(PROP)["groups"] if x["key"] == "audit_behind"), None)
		self.assertIsNotNone(g)
		self.assertIn("3 days behind", g["items"][0]["detail"])

	def test_a_current_business_date_is_not_listed(self):
		frappe.db.set_value("Property", PROP, "business_date", nowdate())
		self.assertFalse(any(x["key"] == "audit_behind" for x in attention.attention(PROP)["groups"]))
