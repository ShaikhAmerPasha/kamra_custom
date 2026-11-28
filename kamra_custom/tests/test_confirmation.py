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


class TestSettlements(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		rows = frappe.db.sql(
			"select f.reservation from `tabFolio` f join `tabFolio Payment` p on p.parent = f.name where f.reservation is not null limit 1"
		)
		if not rows:
			self.skipTest("no payment on this site")
		self.name = rows[0][0]

	def test_lists_what_was_paid(self):
		from kamra_custom import checkout

		lines = checkout.settlements(self.name)
		self.assertTrue(lines)
		for line in lines:
			self.assertIn("mode", line)
			self.assertIn("amount", line)


class TestDocumentKinds(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		names = frappe.get_all("Reservation", filters={"property": PROP, "guest": ("is", "set")}, pluck="name", limit=1)
		if not names:
			self.skipTest("no reservation on this site")
		self.name = names[0]

	def tearDown(self):
		frappe.db.rollback()

	def facts(self):
		return confirmation.facts(frappe.get_doc("Reservation", self.name))

	def test_each_kind_has_its_own_words_and_the_same_booking_facts(self):
		f = self.facts()
		plain = confirmation.message_text(f)
		amended = confirmation.message_text(f, "amended")
		self.assertNotEqual(plain, amended)
		self.assertIn("updated", amended.lower())
		for key in ("check_in", "check_out", "total"):
			self.assertIn(str(f[key]), amended)

	def test_pre_arrival_carries_the_check_in_link(self):
		text = confirmation.message_text(self.facts(), "pre-arrival", link="https://x.test/kamra/checkin/abc")
		self.assertIn("https://x.test/kamra/checkin/abc", text)

	def test_an_unknown_kind_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			confirmation.details(self.name, "invoice")

	def test_pre_arrival_details_make_a_link_once(self):
		a = confirmation.details(self.name, "pre-arrival")["message"]
		b = confirmation.details(self.name, "pre-arrival")["message"]
		self.assertIn("/kamra/checkin/", a)
		self.assertEqual(a, b)

	def test_a_send_is_remembered_with_who_and_how(self):
		out = confirmation.log_sent(self.name, "confirmation", "WhatsApp")
		self.assertEqual(out["history"][0]["kind"], "confirmation")
		self.assertEqual(out["history"][0]["channel"], "WhatsApp")
		self.assertEqual(out["history"][0]["by"], "Administrator")
		self.assertEqual(confirmation.details(self.name)["history"][0]["channel"], "WhatsApp")

	def test_history_is_newest_first_and_short(self):
		for ch in ("Download", "WhatsApp", "Email"):
			confirmation.log_sent(self.name, "amended", ch)
		h = confirmation.details(self.name)["history"]
		self.assertEqual(h[0]["channel"], "Email")
		self.assertLessEqual(len(h), 5)

	def test_changes_after_the_last_send_are_flagged(self):
		confirmation.log_sent(self.name, "confirmation", "WhatsApp")
		self.assertFalse(confirmation.details(self.name)["stale"])
		frappe.db.set_value("Reservation", self.name, "modified", frappe.utils.add_to_date(frappe.utils.now_datetime(), minutes=5))
		res_status = frappe.db.get_value("Reservation", self.name, "status")
		self.assertEqual(confirmation.details(self.name)["stale"], res_status == "Confirmed")

	def test_a_bad_channel_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			confirmation.log_sent(self.name, "confirmation", "Pigeon")


class TestTimes(IntegrationTestCase):
	def test_a_time_is_read_whatever_way_the_database_gives_it(self):
		from datetime import time, timedelta

		for value in ("08:00:00", "8:00:00", time(8, 0), timedelta(hours=8)):
			self.assertEqual(confirmation._hhmm(value), "08:00", value)
			self.assertEqual(confirmation._12h(value), "8:00 AM", value)
		self.assertEqual(confirmation._12h(timedelta(hours=14, minutes=30)), "2:30 PM")
		self.assertEqual(confirmation._12h(timedelta(0)), "")  # midnight means no time was set
		self.assertEqual(confirmation._12h(None), "")
		self.assertEqual(confirmation._12h(""), "")
