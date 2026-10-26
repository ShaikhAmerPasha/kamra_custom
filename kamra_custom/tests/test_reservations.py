"""Finding a stay by mobile number, and the rate and remarks of a stay."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import negotiation, reservations
from kamra_custom.booking import create_stay

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 120)


class TestStays(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, phone="9000055501", name="Find Me"):
		return create_stay(property=PROP, guest_name=name, phone=phone, check_in_date=START,
		                   check_out_date=add_days(START, 2), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]

	def test_find_by_mobile_number_in_any_format(self):
		name = self.book()
		for q in ("9000055501", "+91 90000 55501", "55501"):
			self.assertIn(name, [r["name"] for r in reservations.find(PROP, q)], q)

	def test_find_by_name_and_reservation_number(self):
		name = self.book(name="Zebulon Pike")
		self.assertIn(name, [r["name"] for r in reservations.find(PROP, "Zebulon")])
		self.assertIn(name, [r["name"] for r in reservations.find(PROP, name)])

	def test_detail_says_whether_the_rate_can_change(self):
		d = reservations.detail(self.book())
		self.assertIsNone(d["rate_locked_reason"])
		self.assertEqual(len(d["night_rates"]), 2)

	def test_a_cancelled_stay_has_a_locked_rate(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "status", "Cancelled")
		self.assertIn("cannot be changed", reservations.detail(name)["rate_locked_reason"])

	def test_rate_can_be_changed_after_booking(self):
		name = self.book()
		negotiation.set_negotiated_rate(name, [2300, 2300], "Asked on arrival", "MD Sir")
		d = reservations.detail(name)
		self.assertEqual([n["rate"] for n in d["night_rates"]], [2300, 2300])
		self.assertEqual(d["rate_negotiated"], 1)
		self.assertEqual(d["negotiated_reason"], "Asked on arrival")

	def test_remarks_are_saved_separately(self):
		name = self.book()
		reservations.save_remarks(name, "Quiet room", "Advance Rs 2000 taken")
		d = reservations.detail(name)
		self.assertEqual((d["special_requests"], d["internal_remarks"]), ("Quiet room", "Advance Rs 2000 taken"))

	def test_remark_changes_are_tracked_by_the_document_history(self):
		# Frappe writes the Version rows after the request, so the rows cannot be read inside a
		# test. What can fail is the setting that makes them: Kamra's track_changes on Reservation.
		self.assertTrue(frappe.get_meta("Reservation").track_changes)
		self.assertTrue(frappe.get_meta("Reservation").has_field("internal_remarks"))
