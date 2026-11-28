"""The tape chart's extra read: overdue guests and arrivals without a room."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import tape

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestTapeExtra(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.room = frappe.db.get_value(
			"Room", {"room_type": DLX, "occupancy_status": "Vacant"})
		if not self.room:
			self.skipTest("no free Deluxe room on this site")

	def tearDown(self):
		frappe.db.rollback()

	def book(self, **kw):
		from kamra.api import create_booking

		args = dict(property=PROP, room_type=DLX, check_in_date=nowdate(),
		            check_out_date=add_days(nowdate(), 1), guest_name="Tape Extra Test",
		            phone="9000077711", adults=1)
		args.update(kw)
		# Kamra refuses a booking in the past, so book for today and move the dates afterwards
		wanted = {k: args[k] for k in ("check_in_date", "check_out_date")}
		if wanted["check_in_date"] < nowdate():
			args.update(check_in_date=nowdate(), check_out_date=add_days(nowdate(), 1))
		else:
			wanted = {}
		name = create_booking(**args)["reservation"]
		if wanted:
			frappe.db.set_value("Reservation", name, wanted)
		return name

	def names(self, key, **kw):
		return [b["name"] for b in tape.extra_stays(PROP, **kw)[key]]

	def test_arrival_without_a_room_is_returned(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "room", None)
		self.assertIn(name, self.names("unassigned"))
		self.assertNotIn(name, self.names("overdue"))

	def test_arrival_with_a_room_is_not_returned(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "room", self.room)
		self.assertNotIn(name, self.names("unassigned"))

	def test_unassigned_outside_the_window_is_not_returned(self):
		name = self.book(check_in_date=add_days(nowdate(), 40), check_out_date=add_days(nowdate(), 41))
		frappe.db.set_value("Reservation", name, "room", None)
		self.assertNotIn(name, self.names("unassigned"))
		self.assertIn(name, self.names("unassigned", start_date=add_days(nowdate(), 39)))

	def test_checked_in_past_departure_is_overdue(self):
		name = self.book(check_in_date=add_days(nowdate(), -3), check_out_date=add_days(nowdate(), -1))
		frappe.db.set_value("Reservation", name, {"room": self.room, "status": "Checked In"})
		self.assertIn(name, self.names("overdue"))

	def test_departing_today_is_not_overdue(self):
		name = self.book(check_in_date=add_days(nowdate(), -1), check_out_date=nowdate())
		frappe.db.set_value("Reservation", name, {"room": self.room, "status": "Checked In"})
		self.assertNotIn(name, self.names("overdue"))

	def test_checked_out_and_confirmed_are_not_overdue(self):
		a = self.book(check_in_date=add_days(nowdate(), -3), check_out_date=add_days(nowdate(), -1))
		frappe.db.set_value("Reservation", a, {"room": self.room, "status": "Checked Out"})
		b = self.book(check_in_date=add_days(nowdate(), -3), check_out_date=add_days(nowdate(), -1),
		              phone="9000077712")
		frappe.db.set_value("Reservation", b, {"room": self.room, "status": "Confirmed"})
		self.assertNotIn(a, self.names("overdue"))
		self.assertNotIn(b, self.names("overdue"))

	def test_kamra_tape_chart_still_leaves_them_out(self):
		# the reason this read exists: if Kamra starts drawing them, this one can be dropped
		from kamra.api import tape_chart

		name = self.book(check_in_date=add_days(nowdate(), -3), check_out_date=add_days(nowdate(), -1))
		frappe.db.set_value("Reservation", name, {"room": self.room, "status": "Checked In"})
		drawn = [b["name"] for r in tape_chart(PROP)["rooms"] for b in r["bookings"]]
		self.assertNotIn(name, drawn)
