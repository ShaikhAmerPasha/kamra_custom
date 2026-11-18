"""The tape chart carries what its hover card shows: paid, due, children and meal plan."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestTapeChart(IntegrationTestCase):
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

	def test_each_booking_carries_its_card_figures(self):
		from kamra.api import create_booking

		out = create_booking(
			property=PROP, room_type=DLX, check_in_date=add_days(nowdate(), 1),
			check_out_date=add_days(nowdate(), 3), guest_name="Tape Card Test",
			phone="9000077703", adults=2, children=1,
		)
		frappe.db.set_value("Reservation", out["reservation"], "room", self.room)
		data = overrides.tape_chart(property=PROP, start_date=nowdate(), days=7)
		mine = [b for r in data["rooms"] for b in r["bookings"] if b["name"] == out["reservation"]]
		self.assertEqual(len(mine), 1)
		b = mine[0]
		self.assertEqual(b["children"], 1)
		self.assertEqual(b["paid"], 0)
		self.assertGreater(b["due"], 0)
		self.assertIn("meal_plan", b)

	def test_the_grid_is_kamras_own(self):
		from kamra.api import tape_chart as kamra_tape_chart

		ours = overrides.tape_chart(property=PROP, start_date=nowdate(), days=7)
		kamras = kamra_tape_chart(property=PROP, start_date=nowdate(), days=7)
		self.assertEqual(ours["dates"], kamras["dates"])
		self.assertEqual([r["name"] for r in ours["rooms"]], [r["name"] for r in kamras["rooms"]])
		self.assertEqual(ours["position"], kamras["position"])
