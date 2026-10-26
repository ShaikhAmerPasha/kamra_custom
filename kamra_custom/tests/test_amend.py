"""Amending a stay keeps what the guest was promised, on every night of the new dates."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import complimentary, overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"
IN = add_days(nowdate(), 40)


def call(method, **kw):
	return frappe.get_attr(frappe.override_whitelisted_method(method))(**kw)


class TestAmendKeepsThePrice(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		frappe.db.set_single_value("Kamra Custom Settings", "assign_room_at_checkin", 0)
		self.cp = frappe.db.get_value("Meal Plan", {"property": PROP, "code": "EP"})

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, nights=1, **kw):
		args = dict(property=PROP, room_type=DLX, check_in_date=IN, check_out_date=add_days(IN, nights),
		            guest_name="Amend Price", phone="9000088801", meal_plan=self.cp,
		            custom_rate={"rates": [3000] * nights, "approver": "MD Sir", "all_in": True})
		args.update(kw)
		return overrides.create_booking(**args)["reservation"]

	def amend(self, ref, nights):
		return call("kamra.api.amend_stay", reservation=ref, check_in_date=IN, check_out_date=add_days(IN, nights), confirm_price=1)

	def rows(self, ref):
		return [(r.rate, r.meal_amount) for r in frappe.get_doc("Reservation", ref).night_rates]

	def test_the_agreed_all_in_rate_carries_to_added_nights(self):
		ref = self.book(1)
		out = self.amend(ref, 3)
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual(r.nights, 3)
		self.assertEqual(len(r.night_rates), 3)
		self.assertAlmostEqual(r.amount_before_tax, 9000, places=1)
		self.assertAlmostEqual(out["amount_after_tax"], 9450, places=1)
		self.assertEqual(self.rows(ref), [(2000, 1000)] * 3)
		self.assertEqual((r.rate_negotiated, r.rate_approved_by, r.rate_all_in), (1, "MD Sir", 1))

	def test_a_shorter_stay_bills_fewer_nights_at_the_agreed_rate(self):
		ref = self.book(3)
		self.amend(ref, 1)
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual(len(r.night_rates), 1)
		self.assertAlmostEqual(r.amount_before_tax, 3000, places=1)

	def test_a_desk_user_can_extend_a_big_discount_already_approved(self):
		# 20% below the system rate needs a manager to AGREE it; lengthening the stay must not ask again
		ref = self.book(1)
		user = "amend.desk@test.local"
		if not frappe.db.exists("User", user):
			frappe.get_doc({"doctype": "User", "email": user, "first_name": "Amend", "send_welcome_email": 0,
			                "roles": [{"role": "Front Desk"}]}).insert()
		frappe.set_user(user)
		self.amend(ref, 2)
		self.assertAlmostEqual(frappe.db.get_value("Reservation", ref, "amount_before_tax"), 6000, places=1)

	def test_a_complimentary_stay_stays_free_when_extended(self):
		ref = self.book(1, custom_rate=None)
		complimentary.mark(ref, "MD Sir", "Owner's guest")
		self.amend(ref, 3)
		r = frappe.get_doc("Reservation", ref)
		self.assertEqual((r.amount_after_tax, len(r.night_rates), r.is_complimentary), (0, 3, 1))
		self.assertGreater(r.complimentary_value, 0)

	def test_an_ordinary_stay_is_still_repriced_by_kamra(self):
		ref = self.book(1, custom_rate=None)
		one = frappe.db.get_value("Reservation", ref, "amount_after_tax")
		self.amend(ref, 2)
		self.assertAlmostEqual(frappe.db.get_value("Reservation", ref, "amount_after_tax"), one * 2, places=1)
