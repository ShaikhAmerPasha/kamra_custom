"""Night by night price and the booking trail (kamra_custom.stay_facts)."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import stay_facts
from kamra_custom.stay_facts import nightly_rows

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestNightlyRows(IntegrationTestCase):
	quote = {"nightly": [{"date": "2026-11-18", "rate": 2900, "gst_rate": 5}, {"date": "2026-11-19", "rate": 3100, "gst_rate": 5}],
	         "meal_total": 0}

	def test_one_row_per_night_with_tax(self):
		rows = nightly_rows(self.quote, 6300)
		self.assertEqual(len(rows), 2)
		self.assertEqual(rows[0]["total"], 3045.0)
		self.assertEqual(rows[1]["tax"], 155.0)

	def test_rows_add_up_to_the_booking_total(self):
		rows = nightly_rows(self.quote, 6300)
		self.assertAlmostEqual(sum(r["total"] for r in rows), 6300)

	def test_a_discount_shows_as_its_own_row(self):
		rows = nightly_rows(self.quote, 6000)
		self.assertEqual(rows[-1]["label"], "other")
		self.assertEqual(rows[-1]["total"], -300.0)
		self.assertAlmostEqual(sum(r["total"] for r in rows), 6000)

	def test_meal_is_shared_across_nights(self):
		q = {**self.quote, "meal_total": 1000}
		rows = nightly_rows(q, 7350)
		self.assertEqual(rows[0]["meal"], 500.0)

	def test_no_quote_no_rows(self):
		self.assertEqual(nightly_rows({}, 100), [])


class TestStayFacts(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

	def book(self):
		from kamra.api import create_booking

		return create_booking(property=PROP, room_type=DLX, check_in_date=nowdate(),
		                      check_out_date=add_days(nowdate(), 2), guest_name="Facts Test", phone="9000077705",
		                      adults=1)["reservation"]

	def test_a_booking_has_nightly_rows_and_a_trail(self):
		name = self.book()
		out = stay_facts.stay_facts(name)
		self.assertEqual(len(out["nightly"]), 2)
		self.assertAlmostEqual(sum(r["total"] for r in out["nightly"]), out["total"])
		self.assertTrue(out["trail"]["reserved_by"])
		self.assertEqual(out["trail"]["checked_in_by"], "")
		self.assertFalse(out["agreed"])

	def test_unknown_reservation_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			stay_facts.stay_facts("RES-NOPE")


class TestStayMoney(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

	def test_money_lists_bills_with_their_lines(self):
		from kamra.api import create_booking

		name = create_booking(property=PROP, room_type=DLX, check_in_date=nowdate(), check_out_date=add_days(nowdate(), 1),
		                      guest_name="Money Test", phone="9000077706", adults=1)["reservation"]
		out = stay_facts.stay_money(name)
		self.assertEqual(out["reservation"], name)
		self.assertIsInstance(out["folios"], list)
		for f in out["folios"]:
			for c in f["charges"]:
				self.assertIn("void", c)
			for p in f["payments"]:
				self.assertIn("mode", p)

	def test_a_closed_stay_shows_its_charges_and_payments(self):
		name = frappe.db.get_value("Reservation", {"status": "Checked Out", "property": PROP, "guest_name": "Phase One Guest"})
		if not name:
			self.skipTest("no checked-out stay to read")
		out = stay_facts.stay_money(name)
		f = out["folios"][0]
		self.assertTrue(f["charges"])
		self.assertTrue(f["payments"])
		self.assertAlmostEqual(f["total"] - f["paid"], f["balance"], places=1)

	def test_unknown_reservation_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			stay_facts.stay_money("RES-NOPE")

	def test_facts_carry_the_id_rule_and_room_status(self):
		from kamra.api import create_booking

		name = create_booking(property=PROP, room_type=DLX, check_in_date=nowdate(), check_out_date=add_days(nowdate(), 1),
		                      guest_name="Id Test", phone="9000077707", adults=1)["reservation"]
		facts = stay_facts.stay_facts(name)
		self.assertFalse(facts["id_on_file"])
		guest = frappe.db.get_value("Reservation", name, "guest")
		frappe.db.set_value("Guest", guest, "id_number", "123412341234")
		self.assertTrue(stay_facts.stay_facts(name)["id_on_file"])
		self.assertIn("room_status", facts)
