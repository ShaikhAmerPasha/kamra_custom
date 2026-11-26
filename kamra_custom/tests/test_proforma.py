"""The proforma ends on the booking's own total and posts nothing."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import proforma

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 190)


class TestProforma(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, nights=3, meal_plan=None, phone="9000044401"):
		from kamra.api import create_booking

		kw = {"meal_plan": meal_plan} if meal_plan else {}
		return create_booking(property=PROP, room_type=DLX, check_in_date=START, check_out_date=add_days(START, nights),
		                      guest_name="Proforma Guest", phone=phone, **kw)["reservation"]

	def test_it_lists_each_night_and_ends_on_the_booking_total(self):
		name = self.book(3)
		out = proforma.reservation(name)
		stay = out["stays"][0]
		self.assertEqual([l["code"] for l in stay["lines"] if l["code"] == "Room"], ["Room"] * 3)
		self.assertAlmostEqual(stay["total"], frappe.db.get_value("Reservation", name, "amount_after_tax"), places=1)
		self.assertAlmostEqual(stay["amount"] + stay["tax"], stay["total"], places=1)
		self.assertEqual(out["total"], stay["total"])

	def test_the_meal_plan_is_its_own_line_per_night(self):
		plan = frappe.get_all("Meal Plan", filters={"property": PROP}, pluck="name", limit=1)
		if not plan:
			self.skipTest("no meal plan on this site")
		name = self.book(2, meal_plan=plan[0])
		lines = proforma.reservation(name)["stays"][0]["lines"]
		if not any(l["code"] == "Meal Plan" for l in lines):
			self.skipTest("this meal plan adds no amount")
		self.assertEqual(sum(1 for l in lines if l["code"] == "Meal Plan"), 2)
		stay = proforma.reservation(name)["stays"][0]
		self.assertAlmostEqual(stay["total"], frappe.db.get_value("Reservation", name, "amount_after_tax"), places=1)

	def test_what_the_nights_do_not_explain_is_shown_not_dropped(self):
		name = self.book(2)
		frappe.db.set_value("Reservation", name, {"amount_before_tax": 5000, "tax_amount": 250, "amount_after_tax": 5250})
		stay = proforma.reservation(name)["stays"][0]
		self.assertAlmostEqual(stay["total"], 5250, places=1)
		self.assertTrue(any(l["code"] == "Other" for l in stay["lines"]))

	def test_paid_and_balance(self):
		name = self.book(2)
		frappe.db.set_value("Reservation", name, "advance_paid", 1000)
		stay = proforma.reservation(name)["stays"][0]
		self.assertEqual(stay["paid"], 1000)
		self.assertAlmostEqual(stay["balance"], stay["total"] - 1000, places=1)

	def test_it_posts_nothing(self):
		name = self.book(2)
		before = frappe.db.count("Folio", {"reservation": name})
		proforma.reservation(name)
		self.assertEqual(frappe.db.count("Folio", {"reservation": name}), before)

	def test_a_group_proforma_sums_its_live_rooms(self):
		from kamra.api import create_group_booking

		out = create_group_booking(property=PROP, group_name="Proforma Group", check_in_date=START, check_out_date=add_days(START, 2),
		                           rooms=[{"room_type": DLX, "count": 2}], guest_name="Proforma Lead", phone="9000044410")
		frappe.db.set_value("Reservation", out["created"][0], "status", "Cancelled")
		pf = proforma.group(out["group_booking"])
		self.assertEqual(len(pf["stays"]), 1)
		self.assertAlmostEqual(pf["total"], pf["stays"][0]["total"], places=2)
		self.assertEqual(pf["group"]["group_name"], "Proforma Group")

	def test_the_hotel_block_is_filled(self):
		out = proforma.reservation(self.book(1))
		self.assertEqual(out["hotel"]["name"], frappe.db.get_value("Property", PROP, "property_name"))
		self.assertTrue(out["currency"])
