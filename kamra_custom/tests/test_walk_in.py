"""A walk-in at the desk can carry an agreed rate and internal remarks, like a booking."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestWalkIn(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.room = frappe.db.get_value(
			"Room", {"room_type": DLX, "occupancy_status": "Vacant", "housekeeping_status": "Clean"}
		)
		if not self.room:
			self.skipTest("no free Deluxe room on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def walk_in(self, **kw):
		args = dict(
			property=PROP, room_type=DLX, room=self.room, check_out_date=add_days(nowdate(), 1),
			guest_name="Walk In Test", phone="9000077702", defer_check_in=1,
		)
		args.update(kw)
		return overrides.walk_in(**args)

	def test_agreed_rate_and_remarks_land_on_the_walk_in(self):
		out = self.walk_in(
			internal_remarks="Regular, agreed at the desk",
			custom_rate={"rates": [2300], "reason": "Repeat guest", "approver": "Front Office"},
		)
		doc = frappe.get_doc("Reservation", out["reservation"])
		self.assertEqual(doc.rate_negotiated, 1)
		self.assertEqual(doc.internal_remarks, "Regular, agreed at the desk")
		self.assertAlmostEqual(doc.amount_before_tax, 2300, places=1)

	def test_a_walk_in_without_an_agreed_rate_is_unchanged(self):
		out = self.walk_in()
		doc = frappe.get_doc("Reservation", out["reservation"])
		self.assertEqual(doc.rate_negotiated, 0)
