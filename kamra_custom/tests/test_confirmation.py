import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import confirmation

PROP = "SR Continental"


class TestConfirmation(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		names = frappe.get_all("Reservation", filters={"property": PROP, "guest": ("is", "set")}, pluck="name", limit=1)
		if not names:
			self.skipTest("no reservation on this site")
		self.name = names[0]

	def tearDown(self):
		frappe.db.rollback()

	def test_details_hold_the_message_and_the_contacts(self):
		d = confirmation.details(self.name)
		self.assertIn(self.name, d["message"])
		self.assertIn(d["guest"], d["message"])

	def test_the_message_names_dates_room_and_total(self):
		f = confirmation.facts(frappe.get_doc("Reservation", self.name))
		text = confirmation.message_text(f)
		for key in ("check_in", "check_out", "room_type", "total"):
			self.assertIn(str(f[key]), text)

	def test_phone_and_email_are_saved_on_the_guest(self):
		out = confirmation.save_contact(self.name, "+91 98450 12345", "guest@example.com")
		self.assertEqual(out["email"], "guest@example.com")
		guest = frappe.db.get_value("Reservation", self.name, "guest")
		self.assertEqual(frappe.db.get_value("Guest", guest, "email"), "guest@example.com")

	def test_a_bad_email_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			confirmation.save_contact(self.name, None, "not-an-email")

	def test_the_pdf_is_a_pdf(self):
		pdf = confirmation._pdf(frappe.get_doc("Reservation", self.name))
		self.assertTrue(pdf.startswith(b"%PDF"))

	def test_an_email_needs_an_address(self):
		guest = frappe.db.get_value("Reservation", self.name, "guest")
		frappe.db.set_value("Guest", guest, "email", None)
		with self.assertRaises(frappe.ValidationError):
			confirmation.send_email(self.name)


class TestCheckInTimeLock(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		rows = frappe.get_all("Reservation", filters={"actual_check_in": ("is", "set")}, pluck="name", limit=1)
		if not rows:
			self.skipTest("no stay with a check-in time on this site")
		self.name = rows[0]

	def tearDown(self):
		frappe.db.rollback()

	def test_the_check_in_time_cannot_change_after_check_in(self):
		from kamra_custom import overrides

		with self.assertRaises(frappe.ValidationError):
			overrides.set_actual_times(self.name, actual_check_in="2026-01-01 10:00:00")

	def test_the_check_out_time_can_still_be_corrected(self):
		from kamra_custom import overrides

		out = overrides.set_actual_times(self.name, actual_check_out="2026-01-02 11:00:00")
		self.assertTrue(out["ok"])
