"""Kamra's own cancel and amend rules, checked so we know the desk can rely on them."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"
FAR = add_days(nowdate(), 60)


def call(method, **kw):
	return frappe.get_attr(frappe.override_whitelisted_method(method))(**kw)


class TestCancelAndAmendRules(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		frappe.db.set_single_value("Kamra Custom Settings", "assign_room_at_checkin", 0)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, start=FAR, nights=1, phone="9000099901", **kw):
		args = dict(property=PROP, room_type=DLX, check_in_date=start, check_out_date=add_days(start, nights),
		            guest_name="Rule Test", phone=phone)
		args.update(kw)
		return overrides.create_booking(**args)["reservation"]

	def free(self, start, nights=1):
		from kamra.api import available_rooms
		return len(available_rooms(PROP, DLX, start, add_days(start, nights)))

	def test_cancelling_gives_the_room_back_to_sale(self):
		before = self.free(FAR)
		ref = self.book()
		self.assertEqual(self.free(FAR), before - 1)
		call("kamra.api.cancel_reservation", reservation=ref, reason="Guest request")
		self.assertEqual(self.free(FAR), before)

	def test_a_cancelled_booking_cannot_be_cancelled_again_or_amended(self):
		ref = self.book()
		call("kamra.api.cancel_reservation", reservation=ref)
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.cancel_reservation", reservation=ref)
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.amend_stay", reservation=ref, check_in_date=FAR, check_out_date=add_days(FAR, 2), confirm_price=1)

	def test_a_checked_in_guest_cannot_be_cancelled(self):
		ref = self.book(start=nowdate())
		call("kamra.api.check_in", reservation=ref)
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.cancel_reservation", reservation=ref)

	def test_extending_into_a_sold_out_night_is_refused(self):
		total = frappe.db.count("Room", {"room_type": DLX})
		for i in range(total):
			self.book(start=add_days(FAR, 1), phone=f"90000999{i:02d}", guest_name=f"Fill {i}")
		ref = self.book(start=FAR, phone="9000099950", guest_name="Extender")
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.amend_stay", reservation=ref, check_in_date=FAR, check_out_date=add_days(FAR, 2), confirm_price=1)
		self.assertEqual(str(frappe.db.get_value("Reservation", ref, "check_out_date")), add_days(FAR, 1))

	def test_a_stay_cannot_be_moved_into_the_past_or_end_before_it_starts(self):
		ref = self.book()
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.amend_stay", reservation=ref, check_in_date=add_days(nowdate(), -3), check_out_date=FAR, confirm_price=1)
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.amend_stay", reservation=ref, check_in_date=FAR, check_out_date=FAR, confirm_price=1)

	def test_a_price_change_needs_the_desk_to_confirm_it(self):
		ref = self.book()
		with self.assertRaises(frappe.ValidationError):
			call("kamra.api.amend_stay", reservation=ref, check_in_date=FAR, check_out_date=add_days(FAR, 2))
		self.assertEqual(frappe.db.get_value("Reservation", ref, "nights"), 1)

	def test_a_late_cancel_charges_the_policy_fee_and_a_free_one_charges_nothing(self):
		soon = self.book(start=add_days(nowdate(), 1), phone="9000099960")
		preview = call("kamra.api.cancellation_preview", reservation=soon)
		out = call("kamra.api.cancel_reservation", reservation=soon)
		self.assertEqual(bool(out["fee"]), bool(preview["inside_window"] and preview["fee_basis"] != "None"))
		far = self.book(phone="9000099961")
		self.assertEqual(call("kamra.api.cancel_reservation", reservation=far)["fee"], 0)
		self.assertTrue(frappe.db.get_value("Reservation", far, "cancellation_number"))

	def test_waiving_the_fee_is_logged(self):
		soon = self.book(start=add_days(nowdate(), 1), phone="9000099962")
		out = call("kamra.api.cancel_reservation", reservation=soon, waive_fee=1)
		self.assertEqual(out["fee"], 0)
		self.assertTrue(frappe.db.exists("Agent Action Log", {"action_type": "cancel_reservation", "reference_name": soon, "rationale": ("like", "%waived%")}))
