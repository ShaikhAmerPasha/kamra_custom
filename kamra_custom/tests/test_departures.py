"""Departures include guests who are still checked in after their departure date."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestDepartures(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.room = frappe.db.get_value("Room", {"room_type": DLX, "occupancy_status": "Vacant"})
		if not self.room:
			self.skipTest("no free Deluxe room on this site")

	def tearDown(self):
		frappe.db.rollback()

	def stay(self, check_out, status="Checked In", phone="9000077721"):
		from kamra.api import create_booking

		name = create_booking(property=PROP, room_type=DLX, check_in_date=nowdate(),
		                      check_out_date=add_days(nowdate(), 1), guest_name="Departure Test",
		                      phone=phone, adults=1)["reservation"]
		frappe.db.set_value("Reservation", name, {
			"check_in_date": add_days(nowdate(), -3), "check_out_date": check_out,
			"room": self.room, "status": status})
		return name

	def departures(self, date=None):
		out = overrides.front_desk_snapshot(property=PROP, date=date) if date else overrides.front_desk_snapshot(property=PROP)
		return out["departures"]

	def test_overdue_guest_is_listed_with_money_and_flags(self):
		name = self.stay(add_days(nowdate(), -1))
		row = next((r for r in self.departures() if r["name"] == name), None)
		self.assertIsNotNone(row)
		self.assertIn("balance_due", row)
		self.assertIn("id_missing", row)

	def test_overdue_guests_come_first(self):
		today = self.stay(nowdate(), phone="9000077722")
		late = self.stay(add_days(nowdate(), -2))
		names = [r["name"] for r in self.departures()]
		self.assertLess(names.index(late), names.index(today))

	def test_no_duplicate_when_leaving_today(self):
		name = self.stay(nowdate())
		self.assertEqual([r["name"] for r in self.departures()].count(name), 1)

	def test_checked_out_and_confirmed_are_not_listed(self):
		a = self.stay(add_days(nowdate(), -1), status="Checked Out")
		b = self.stay(add_days(nowdate(), -1), status="Confirmed", phone="9000077723")
		names = [r["name"] for r in self.departures()]
		self.assertNotIn(a, names)
		self.assertNotIn(b, names)

	def test_another_day_shows_only_its_own_departures(self):
		name = self.stay(add_days(nowdate(), -1))
		self.assertNotIn(name, [r["name"] for r in self.departures(add_days(nowdate(), 1))])

	def test_rows_carry_the_guest_phone_and_company_name(self):
		name = self.stay(add_days(nowdate(), -1), phone="9000077741")
		row = next(r for r in self.departures() if r["name"] == name)
		self.assertIn("9000077741", row["phone"].replace(" ", "").replace("+91", ""))
		self.assertEqual(row["company_name"], "")
