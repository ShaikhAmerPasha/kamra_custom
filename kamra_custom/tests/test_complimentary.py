"""Complimentary stays: free room and meal, on record, approved by MD Sir or GM Sir."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import complimentary, overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"
TODAY = nowdate()
TOMORROW = add_days(TODAY, 1)


class TestComplimentary(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		# these tests assume Kamra's own way: a room is given at booking. The hotel's switches must not change that.
		frappe.db.set_single_value("Kamra Custom Settings", "assign_room_at_checkin", 0)
		frappe.db.set_single_value("Kamra Custom Settings", "clean_rooms_only", 0)
		self.cp = frappe.db.get_value("Meal Plan", {"property": PROP, "code": "CP"})

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, **kw):
		args = dict(property=PROP, room_type=DLX, check_in_date=TODAY, check_out_date=TOMORROW,
		            guest_name="Comp Test", phone="9000077701", meal_plan=self.cp)
		args.update(kw)
		return overrides.create_booking(**args)["reservation"]

	def test_room_and_meal_become_free_and_the_value_is_kept(self):
		ref = self.book()
		worth = frappe.db.get_value("Reservation", ref, "amount_after_tax")
		self.assertGreater(worth, 0)
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual((r.is_complimentary, r.complimentary_approver, r.complimentary_by), (1, "MD Sir", "Administrator"))
		self.assertAlmostEqual(r.complimentary_value, worth, places=1)
		self.assertEqual((r.amount_before_tax, r.amount_after_tax), (0, 0))
		self.assertEqual([(n.rate, n.meal_amount) for n in r.night_rates], [(0, 0)])

	def test_only_md_or_gm_can_approve(self):
		ref = self.book()
		with self.assertRaisesRegex(frappe.ValidationError, "cannot approve"):
			complimentary.mark(ref, "Front Office", "Friend")
		with self.assertRaises(frappe.ValidationError):
			complimentary.mark(ref, "", "Friend")
		self.assertFalse(frappe.db.get_value("Reservation", ref, "is_complimentary"))

	def test_a_reason_is_needed_and_it_cannot_be_done_twice(self):
		ref = self.book()
		with self.assertRaisesRegex(frappe.ValidationError, "why"):
			complimentary.mark(ref, "GM Sir", "  ")
		complimentary.mark(ref, "GM Sir", "VIP")
		with self.assertRaisesRegex(frappe.ValidationError, "already"):
			complimentary.mark(ref, "GM Sir", "VIP")

	def test_the_night_posts_a_zero_room_line_and_no_meal(self):
		from kamra.api import check_in
		from kamra.folio import post_room_night

		ref = self.book()
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		check_in(ref)
		post_room_night(frappe.get_doc("Reservation", ref), TODAY)
		lines = frappe.get_all("Folio Charge", filters={"reservation": ref}, fields=["charge_type", "amount"])
		self.assertEqual([(l.charge_type, l.amount) for l in lines if l.charge_type in ("Room", "Meal Plan")], [("Room", 0)])

	def test_it_is_refused_once_a_night_is_billed(self):
		from kamra.api import check_in
		from kamra.folio import post_room_night

		ref = self.book()
		check_in(ref)
		post_room_night(frappe.get_doc("Reservation", ref), TODAY)
		with self.assertRaisesRegex(frappe.ValidationError, "already on the bill"):
			complimentary.mark(ref, "MD Sir", "Late decision")

	def test_a_manager_can_undo_it_and_the_price_returns(self):
		ref = self.book()
		worth = frappe.db.get_value("Reservation", ref, "amount_after_tax")
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		out = complimentary.unmark(ref)
		self.assertAlmostEqual(out["amount_after_tax"], worth, places=1)
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual((r.is_complimentary, r.complimentary_approver), (0, None))
		self.assertGreater(r.night_rates[0].meal_amount, 0)

	def test_undo_drops_the_agreed_rate_and_its_approver(self):
		ref = self.book(custom_rate={"rates": [5000], "approver": "GM Sir", "all_in": True})
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		complimentary.unmark(ref)
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual((r.rate_approved_by, r.rate_all_in, r.rate_negotiated), (None, 0, 0))

	def test_a_desk_user_cannot_undo_it(self):
		ref = self.book()
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		user = "comp.desk@test.local"
		if not frappe.db.exists("User", user):
			frappe.get_doc({"doctype": "User", "email": user, "first_name": "Comp", "send_welcome_email": 0,
			                "roles": [{"role": "Front Desk"}]}).insert()
		frappe.set_user(user)
		with self.assertRaises(frappe.PermissionError):
			complimentary.unmark(ref)

	def test_a_restaurant_order_of_the_guest_is_marked_nc(self):
		ref = self.book()
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		order = frappe.new_doc("POS Order")
		order.reservation = ref
		complimentary.restaurant_nc(order)
		self.assertEqual((order.nc, order.nc_authorized_by), (1, "MD Sir"))

	def test_an_ordinary_guest_order_is_not_touched(self):
		ref = self.book()
		order = frappe.new_doc("POS Order")
		order.reservation = ref
		complimentary.restaurant_nc(order)
		self.assertFalse(order.nc)

	def test_the_switch_turns_the_nc_off(self):
		ref = self.book()
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		frappe.db.set_single_value("Kamra Custom Settings", "complimentary_pos_nc", 0)
		order = frappe.new_doc("POS Order")
		order.reservation = ref
		complimentary.restaurant_nc(order)
		self.assertFalse(order.nc)

	def test_status_tells_the_check_in_box_what_to_show(self):
		ref = self.book()
		s = complimentary.status(ref)
		self.assertTrue(s["can_mark"])
		self.assertEqual(set(s["approvers"]), {"MD Sir", "GM Sir"})
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		s = complimentary.status(ref)
		self.assertTrue(s["complimentary"] and s["can_undo"] and not s["can_mark"])
