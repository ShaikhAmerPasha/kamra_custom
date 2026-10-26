"""Room assigned at check-in, and check-in to clean rooms only."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"
TOMORROW = add_days(nowdate(), 1)


def switch(name, value):
	frappe.db.set_single_value("Kamra Custom Settings", name, value)


class TestAssignAtCheckin(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.room = frappe.db.get_value(
			"Room", {"room_type": DLX, "occupancy_status": "Vacant", "housekeeping_status": "Clean"}
		)
		if not self.room:
			self.skipTest("no free Deluxe room on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, **kw):
		args = dict(property=PROP, room_type=DLX, check_in_date=nowdate(), check_out_date=TOMORROW,
		            guest_name="Assign Test", phone="9000055501")
		args.update(kw)
		return overrides.create_booking(**args)["reservation"]

	def room_of(self, name):
		return frappe.db.get_value("Reservation", name, "room")

	def test_by_default_kamra_assigns_a_room_at_booking(self):
		switch("assign_room_at_checkin", 0)
		self.assertTrue(self.room_of(self.book()))

	def test_with_the_switch_on_a_booking_holds_no_room(self):
		switch("assign_room_at_checkin", 1)
		name = self.book()
		self.assertFalse(self.room_of(name))
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "Confirmed")

	def test_a_booking_made_any_other_way_holds_no_room_either(self):
		# the booking page and channel managers insert the reservation themselves
		switch("assign_room_at_checkin", 1)
		guest = frappe.get_doc({"doctype": "Guest", "first_name": "Channel", "last_name": "Test", "phone": "9000055599"}).insert().name
		doc = frappe.get_doc({
			"doctype": "Reservation", "guest": guest, "property": PROP, "room_type": DLX, "room": self.room,
			"check_in_date": nowdate(), "check_out_date": TOMORROW, "adults": 1, "children": 0,
			"guest_name": "Channel Test", "source": "OTA", "status": "Confirmed",
		}).insert()
		self.assertFalse(doc.room)

	def test_a_walk_in_keeps_its_room(self):
		switch("assign_room_at_checkin", 1)
		out = overrides.walk_in(property=PROP, room_type=DLX, room=self.room, check_out_date=TOMORROW,
		                        guest_name="Walk In Assign", phone="9000055502", defer_check_in=1)
		self.assertEqual(self.room_of(out["reservation"]), self.room)

	def test_the_room_is_chosen_at_check_in(self):
		switch("assign_room_at_checkin", 1)
		name = self.book()
		from kamra.api import check_in
		out = check_in(name, room=self.room)
		self.assertEqual(out["room"], self.room)
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "Checked In")

	def test_no_room_means_no_check_in(self):
		switch("assign_room_at_checkin", 1)
		name = self.book()
		from kamra.api import check_in
		with self.assertRaises(frappe.ValidationError):
			check_in(name)

	def test_the_hotel_cannot_sell_more_than_it_has(self):
		switch("assign_room_at_checkin", 1)
		total = frappe.db.count("Room", {"room_type": DLX})
		made = 0
		with self.assertRaises(frappe.ValidationError):
			for i in range(total + 2):
				self.book(phone=f"90000555{i:02d}", guest_name=f"Cap {i}")
				made += 1
		self.assertLessEqual(made, total)

	def test_a_dirty_room_is_refused_when_clean_rooms_only_is_on(self):
		switch("assign_room_at_checkin", 1)
		switch("clean_rooms_only", 1)
		frappe.db.set_value("Room", self.room, "housekeeping_status", "Dirty")
		name = self.book()
		from kamra.api import check_in
		with self.assertRaisesRegex(frappe.ValidationError, "not clean"):
			check_in(name, room=self.room)
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "Confirmed")

	def test_a_dirty_room_still_works_when_the_switch_is_off(self):
		switch("clean_rooms_only", 0)
		frappe.db.set_value("Room", self.room, "housekeeping_status", "Dirty")
		name = self.book(room=self.room)
		from kamra.api import check_in
		check_in(name, room=self.room)
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "Checked In")

	def test_a_clean_room_checks_in_when_clean_rooms_only_is_on(self):
		switch("clean_rooms_only", 1)
		name = self.book(room=self.room)
		from kamra.api import check_in
		check_in(name, room=self.room)
		self.assertEqual(frappe.db.get_value("Reservation", name, "status"), "Checked In")
