"""Billing and analysis fields of a stay: stored, checked, and left out of the money."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import analysis
from kamra_custom.booking import create_stay
from kamra_custom.setup import ensure_schema

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 150)


class TestAnalysis(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		ensure_schema()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, phone="9000077701"):
		return create_stay(property=PROP, guest_name="Analysis Guest", phone=phone, check_in_date=START,
		                   check_out_date=add_days(START, 2), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]

	def test_the_fields_exist_on_reservation(self):
		for f in analysis.FIELDS:
			self.assertTrue(frappe.get_meta("Reservation").has_field(f), f)

	def test_save_and_read_back(self):
		name = self.book()
		out = analysis.save(name, {"pay_by": "Company", "gst_number": "33abcde1234f1z5", "pan_number": "abcde1234f",
		                           "credit_limit": "25000", "guaranteed": 1, "special_guest": "true",
		                           "tax_exempt": 0, "business_source": "Walk-in desk", "domicile": "India"})
		v = out["values"]
		self.assertEqual((v["pay_by"], v["gst_number"], v["pan_number"]), ("Company", "33ABCDE1234F1Z5", "ABCDE1234F"))
		self.assertEqual((v["credit_limit"], v["guaranteed"], v["special_guest"], v["tax_exempt"]), (25000, 1, 1, 0))
		self.assertEqual(analysis.get(name)["values"]["business_source"], "Walk-in desk")

	def test_bad_values_are_refused(self):
		name = self.book()
		for bad in ({"gst_number": "123"}, {"pan_number": "ABC"}, {"credit_limit": "-1"}, {"credit_limit": "lots"},
		            {"pay_by": "Barter"}, {"amount_after_tax": 1}):
			with self.assertRaises(frappe.ValidationError, msg=str(bad)):
				analysis.save(name, bad)

	def test_blank_gst_and_pan_clear_them(self):
		name = self.book()
		analysis.save(name, {"gst_number": "33ABCDE1234F1Z5"})
		self.assertEqual(analysis.save(name, {"gst_number": ""})["values"]["gst_number"], "")

	def test_it_does_not_touch_the_money(self):
		name = self.book()
		before = frappe.db.get_value("Reservation", name, ["amount_before_tax", "tax_amount", "amount_after_tax"])
		analysis.save(name, {"tax_exempt": 1, "pay_by": "Cash"})
		self.assertEqual(frappe.db.get_value("Reservation", name, ["amount_before_tax", "tax_amount", "amount_after_tax"]), before)

	def test_a_closed_stay_cannot_change(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "status", "Cancelled")
		with self.assertRaises(frappe.ValidationError):
			analysis.save(name, {"pay_by": "Cash"})
		self.assertFalse(analysis.get(name)["editable"])

	def test_audit_line(self):
		name = self.book()
		a = analysis.get(name)["audit"]
		self.assertTrue(a["reserved_on"])
		self.assertIsNone(a["checked_in_on"])
		self.assertIsNone(a["checked_out_on"])


class TestBookingCarriesBilling(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		ensure_schema()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def test_create_booking_stores_the_billing_fields(self):
		from kamra_custom import overrides

		out = overrides.create_booking(
			property=PROP, room_type=DLX, check_in_date=START, check_out_date=add_days(START, 1),
			guest_name="Carry Billing", phone="9000077702", billing={"pay_by": "Card", "special_guest": 1, "gst_number": "33ABCDE1234F1Z5"},
		)
		v = analysis.get(out["reservation"])["values"]
		self.assertEqual((v["pay_by"], v["special_guest"], v["gst_number"]), ("Card", 1, "33ABCDE1234F1Z5"))

	def test_a_bad_value_stops_the_booking(self):
		from kamra_custom import overrides

		with self.assertRaises(frappe.ValidationError):
			overrides.create_booking(
				property=PROP, room_type=DLX, check_in_date=START, check_out_date=add_days(START, 1),
				guest_name="Carry Bad", phone="9000077703", billing={"pan_number": "nope"},
			)
