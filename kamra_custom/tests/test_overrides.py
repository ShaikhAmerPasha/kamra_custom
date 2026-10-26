"""Kamra's booking calls with our extras: behaviour Kamra has stays, extras are added."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import hooks

PROP = "SR Continental"
DLX = "SR Continental-DLX"
PRM = "SR Continental-PRM"
START = add_days(nowdate(), 150)
END = add_days(START, 2)


def call(method, **kw):
	"""Call what Frappe would call for `method`, overrides included."""
	return frappe.get_attr(frappe.override_whitelisted_method(method))(**kw)


class TestOverrides(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def booking(self, **kw):
		args = dict(property=PROP, room_type=DLX, check_in_date=START, check_out_date=END,
		            guest_name="Override Test", phone="9000044401")
		args.update(kw)
		return call("kamra.api.create_booking", **args)

	def test_request_bookkeeping_fields_do_not_reach_kamra(self):
		# an HTTP call arrives with fields such as `cmd`; Kamra's functions take none of them
		out = self.booking(cmd="kamra.api.create_booking", _extra="x")
		self.assertTrue(out["reservation"])
		grp = call("kamra.api.create_group_booking", property=PROP, group_name="g", check_in_date=add_days(START, 40),
		           check_out_date=add_days(START, 41), rooms=[{"room_type": DLX, "count": 1}], guest_name="G",
		           phone="9000044406", cmd="kamra.api.create_group_booking")
		self.assertEqual(len(grp["created"]), 1)

	def test_our_functions_are_the_ones_registered(self):
		self.assertEqual(frappe.override_whitelisted_method("kamra.api.create_booking"), "kamra_custom.overrides.create_booking")
		self.assertEqual(frappe.override_whitelisted_method("kamra.api.create_group_booking"), "kamra_custom.overrides.create_group_booking")
		self.assertEqual(frappe.override_whitelisted_method("kamra.api.walk_in"), "kamra_custom.overrides.walk_in")
		self.assertEqual(
			set(hooks.override_whitelisted_methods),
			{"kamra.api.create_booking", "kamra.api.create_group_booking", "kamra.api.walk_in", "kamra.api.amend_stay"},
		)

	def test_the_functions_are_whitelisted(self):
		from frappe import is_whitelisted

		for m in ("kamra.api.create_booking", "kamra.api.create_group_booking", "kamra.api.walk_in", "kamra.api.amend_stay"):
			is_whitelisted(frappe.get_attr(frappe.override_whitelisted_method(m)))

	def test_a_plain_booking_is_exactly_what_kamra_makes(self):
		from kamra.api import create_booking as kamra_original

		ours = self.booking()
		theirs = kamra_original(property=PROP, room_type=DLX, check_in_date=add_days(START, 20),
		                        check_out_date=add_days(END, 20), guest_name="Override Test B", phone="9000044402")
		self.assertEqual(set(ours), set(theirs))
		self.assertEqual(ours["amount_after_tax"], theirs["amount_after_tax"])

	def test_the_dialogs_note_is_kept_where_kamra_shows_it(self):
		out = self.booking(instructions=[{"department": "Front Desk", "instruction": "Quiet room please"}])
		self.assertEqual(frappe.db.get_value("Reservation", out["reservation"], "special_requests"), "Quiet room please")

	def test_internal_remarks_are_stored_apart(self):
		out = self.booking(internal_remarks="Advance 1000 taken", instructions=[{"department": "Front Desk", "instruction": "Late"}])
		r = frappe.db.get_value("Reservation", out["reservation"], ["special_requests", "internal_remarks"], as_dict=True)
		self.assertEqual((r.special_requests, r.internal_remarks), ("Late", "Advance 1000 taken"))

	def test_an_agreed_rate_is_held_and_returned(self):
		out = self.booking(custom_rate={"rates": [2100, 2100], "reason": "Regular", "approver": "MD Sir"})
		r = frappe.db.get_value("Reservation", out["reservation"], ["auto_price", "amount_before_tax", "rate_negotiated"], as_dict=True)
		self.assertEqual((r.auto_price, r.rate_negotiated), (0, 1))
		self.assertAlmostEqual(r.amount_before_tax, 4200, places=1)
		self.assertEqual(out["amount_after_tax"], frappe.db.get_value("Reservation", out["reservation"], "amount_after_tax"))

	def test_a_rate_below_the_floor_books_nothing(self):
		before = frappe.db.count("Reservation")
		with self.assertRaisesRegex(frappe.ValidationError, "guardrail"):
			self.booking(custom_rate={"rates": [545, 545], "reason": "x", "approver": "MD Sir"})
		frappe.db.rollback()
		self.assertEqual(frappe.db.count("Reservation"), before)

	def test_the_returning_guest_is_found_by_number_in_any_format(self):
		first = self.booking(phone="9000044403")
		second = self.booking(phone="+91 90000 44403", check_in_date=add_days(START, 30), check_out_date=add_days(END, 30))
		g = [frappe.db.get_value("Reservation", o["reservation"], "guest") for o in (first, second)]
		self.assertEqual(g[0], g[1])
		self.assertEqual(frappe.db.count("Guest", {"phone_key": "919000044403"}), 1)

	def group(self, rooms, **kw):
		args = dict(property=PROP, group_name="Group test", check_in_date=START, check_out_date=END,
		            rooms=rooms, guest_name="Group Guest", phone="9000044404")
		args.update(kw)
		return call("kamra.api.create_group_booking", **args)

	def test_a_group_keeps_the_guest_remarks_and_each_rooms_rate(self):
		g = frappe.get_doc({"doctype": "Guest", "first_name": "Picked", "phone": "9000044405"}).insert()
		out = self.group(
			[{"room_type": DLX, "count": 1, "adults": 2, "children": 1},
			 {"room_type": PRM, "count": 1, "adults": 2, "children": 0, "custom_rate": {"rates": [3300, 3300], "reason": "Bargain", "approver": "GM Sir"}}],
			guest=g.name, phone="+91 90000 44405", special_requests="Adjacent rooms", internal_remarks="Paid advance",
		)
		self.assertEqual(len(out["created"]), 2)
		docs = [frappe.get_doc("Reservation", n) for n in out["created"]]
		self.assertEqual({d.guest for d in docs}, {g.name})
		self.assertEqual({d.special_requests for d in docs}, {"Adjacent rooms"})
		self.assertEqual({d.internal_remarks for d in docs}, {"Paid advance"})
		self.assertEqual([(d.adults, d.children) for d in docs], [(2, 1), (2, 0)])
		self.assertEqual([d.rate_negotiated for d in docs], [0, 1])
		self.assertAlmostEqual(docs[1].amount_before_tax, 6600, places=1)

	def test_a_group_that_loses_a_room_with_agreed_rates_books_nothing(self):
		before = frappe.db.count("Reservation")
		with self.assertRaises(frappe.ValidationError):
			self.group([
				{"room_type": DLX, "count": 1, "custom_rate": {"rates": [2200, 2200], "reason": "x", "approver": "MD Sir"}},
				{"room_type": DLX, "count": 1, "adults": 9},  # over capacity: Kamra skips it
			])
		frappe.db.rollback()
		self.assertEqual(frappe.db.count("Reservation"), before)


class TestAllInRate(TestOverrides):
	"""With a meal plan the desk agrees one price for room and meal together."""

	def setUp(self):
		super().setUp()
		self.cp = frappe.db.get_value("Meal Plan", {"property": PROP, "code": "CP"})
		if not self.cp:
			self.skipTest("no CP meal plan on this site")
		self.meal = 2 * float(frappe.db.get_value("Meal Plan", self.cp, "price_per_adult"))  # two adults, a night

	def nights_of(self, name):
		return frappe.get_all("Reservation Night Rate", filters={"parent": name}, fields=["rate", "meal_amount"], order_by="stay_date")

	def test_the_meal_comes_off_each_night_to_find_the_room_part(self):
		out = self.booking(meal_plan=self.cp, custom_rate={"rates": [4700, 4700], "approver": "MD Sir", "all_in": True})
		r = frappe.get_doc("Reservation", out["reservation"])
		self.assertEqual((r.rate_all_in, r.rate_negotiated, r.rate_approved_by), (1, 1, "MD Sir"))
		self.assertAlmostEqual(r.amount_before_tax, (2300 + self.meal) * 2, places=1)
		for night in self.nights_of(r.name):
			self.assertAlmostEqual(night.rate, 2300, places=2)
			self.assertAlmostEqual(night.meal_amount, self.meal, places=2)

	def test_an_all_in_price_equal_to_the_system_price_needs_no_approver(self):
		out = self.booking(meal_plan=self.cp, custom_rate={"rates": [2500 + self.meal] * 2, "all_in": True})
		self.assertEqual(frappe.db.get_value("Reservation", out["reservation"], "rate_all_in"), 1)

	def test_a_price_below_the_meal_alone_is_refused(self):
		before = frappe.db.count("Reservation")
		with self.assertRaisesRegex(frappe.ValidationError, "more than the meal"):
			self.booking(meal_plan=self.cp, custom_rate={"rates": [self.meal - 1] * 2, "approver": "MD Sir", "all_in": True})
		frappe.db.rollback()
		self.assertEqual(frappe.db.count("Reservation"), before)

	def test_without_a_meal_plan_the_rate_is_the_room_rate(self):
		out = self.booking(custom_rate={"rates": [2300, 2300], "approver": "MD Sir", "all_in": True})
		r = frappe.get_doc("Reservation", out["reservation"])
		self.assertEqual(r.rate_all_in, 0)
		self.assertAlmostEqual(r.amount_before_tax, 4600, places=1)

	def test_a_room_only_rate_keeps_working_beside_a_meal_plan(self):
		out = self.booking(meal_plan=self.cp, custom_rate={"rates": [2300, 2300], "approver": "MD Sir"})
		r = frappe.get_doc("Reservation", out["reservation"])
		self.assertEqual(r.rate_all_in, 0)
		self.assertAlmostEqual(r.amount_before_tax, (2300 + self.meal) * 2, places=1)

	def test_the_preview_says_what_the_meal_adds(self):
		from kamra_custom import negotiation

		p = negotiation.preview(PROP, DLX, START, END, adults=2, children=0, meal_plan=self.cp)
		self.assertAlmostEqual(p["meal_per_night"], self.meal, places=2)
		q = negotiation.preview(PROP, DLX, START, END, adults=2, children=0, meal_plan=self.cp, rates=[4700, 4700], all_in=1)
		self.assertTrue(q["all_in"])
		self.assertAlmostEqual(q["negotiated"]["room_total"], 4600, places=1)
		self.assertAlmostEqual(q["discount_pct"], 8.0, places=1)
