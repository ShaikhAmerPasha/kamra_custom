"""An extra-guest amount is a final, GST-included figure."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import extra_guest, overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestExtraGuest(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.args = dict(
			property=PROP, room_type=DLX, check_in_date=add_days(nowdate(), 3),
			check_out_date=add_days(nowdate(), 4), adults=2, children=0,
		)

	def tearDown(self):
		frappe.db.rollback()

	def test_typed_amount_is_what_the_guest_pays(self):
		plain = overrides.get_quote(**self.args)
		with_extra = overrides.get_quote(**self.args, over_capacity_charge=1050)
		self.assertAlmostEqual(with_extra["amount_after_tax"] - plain["amount_after_tax"], 1050, places=1)

	def test_the_base_amount_is_below_the_typed_amount(self):
		net = extra_guest.net_extra_charge(gross=1050, **self.args)
		self.assertLess(net, 1050)
		self.assertGreater(net, 800)

	def test_zero_and_missing_stay_as_they_are(self):
		self.assertEqual(extra_guest.net_extra_charge(gross=0, **self.args), 0)
		self.assertEqual(extra_guest.convert({"over_capacity_charge": 500}), {"over_capacity_charge": 500})
		self.assertEqual(extra_guest.convert({"adults": 2}), {"adults": 2})

	def test_no_extra_amount_changes_nothing(self):
		a = overrides.get_quote(**self.args)
		from kamra.api import get_quote

		self.assertEqual(a["amount_after_tax"], get_quote(**self.args)["amount_after_tax"])


class TestBookingOptions(IntegrationTestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_every_company_carries_its_gst_and_contact(self):
		frappe.set_user("Administrator")
		out = overrides.booking_options(property=PROP)
		for c in out["companies"]:
			self.assertIn("gstin", c)
			self.assertIn("contact_name", c)
			self.assertIn("contact_phone", c)
