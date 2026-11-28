"""Arrivals include confirmed bookings whose arrival date has passed."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestMissedArrivals(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

	def stay(self, check_in, status="Confirmed", phone="9000077731"):
		from kamra.api import create_booking

		name = create_booking(property=PROP, room_type=DLX, check_in_date=nowdate(),
		                      check_out_date=add_days(nowdate(), 1), guest_name="Missed Test",
		                      phone=phone, adults=1)["reservation"]
		frappe.db.set_value("Reservation", name, {
			"check_in_date": check_in, "check_out_date": add_days(nowdate(), 2), "status": status})
		return name

	def arrivals(self, date=None):
		args = dict(property=PROP)
		if date:
			args["date"] = date
		return overrides.front_desk_snapshot(**args)["arrivals"]

	def test_a_missed_arrival_is_listed_first_and_flagged(self):
		today = self.stay(nowdate(), phone="9000077732")
		late = self.stay(add_days(nowdate(), -1))
		rows = self.arrivals()
		names = [r["name"] for r in rows]
		self.assertLess(names.index(late), names.index(today))
		row = next(r for r in rows if r["name"] == late)
		self.assertTrue(row["missed"])
		self.assertIn("balance_due", row)
		self.assertIn("id_missing", row)
		self.assertFalse(next(r for r in rows if r["name"] == today).get("missed"))

	def test_can_no_show_follows_the_business_date(self):
		from kamra.business_date import get_business_date

		bd = str(get_business_date(PROP))
		before = self.stay(add_days(bd, 0) if bd < nowdate() else add_days(nowdate(), -1))
		row = next(r for r in self.arrivals() if r["name"] == before)
		self.assertTrue(row["can_no_show"])
		after = self.stay(add_days(bd, 1) if add_days(bd, 1) < nowdate() else add_days(nowdate(), -1), phone="9000077733")
		if add_days(bd, 1) < nowdate():
			self.assertFalse(next(r for r in self.arrivals() if r["name"] == after)["can_no_show"])

	def test_other_statuses_and_other_days_are_left_out(self):
		a = self.stay(add_days(nowdate(), -1), status="Cancelled")
		b = self.stay(add_days(nowdate(), -1), status="Checked In", phone="9000077734")
		c = self.stay(add_days(nowdate(), -1), phone="9000077735")
		names = [r["name"] for r in self.arrivals()]
		self.assertNotIn(a, names)
		self.assertNotIn(b, names)
		self.assertNotIn(c, [r["name"] for r in self.arrivals(add_days(nowdate(), 1))])

	def test_desk_no_show_works_on_a_listed_arrival(self):
		from kamra.night_audit import eod_mark_no_show, no_show_preview
		from kamra.business_date import get_business_date

		name = self.stay(str(get_business_date(PROP)))
		row = next((r for r in self.arrivals() if r["name"] == name), None)
		if not row or not row["can_no_show"]:
			self.skipTest("business date is today on this site")
		self.assertEqual(no_show_preview(name)["reservation"], name)
		eod_mark_no_show(name, "test")
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "No Show")
		self.assertNotIn(name, [r["name"] for r in self.arrivals()])
