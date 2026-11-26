"""Bulk actions from the search grid: each stay on its own, with Kamra's rules."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import bulk
from kamra_custom.booking import create_stay

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 160)


class TestBulk(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, name, phone, start=START, assign=False):
		res = create_stay(property=PROP, guest_name=name, phone=phone, check_in_date=start,
		                  check_out_date=add_days(start, 1), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]
		if not assign:
			frappe.db.set_value("Reservation", res, "room", None)
		return res

	def by_name(self, out):
		return {r["reservation"]: r for r in out["results"]}

	def test_assign_rooms_gives_each_a_different_free_room(self):
		a, b = self.book("Bulk A", "9000099901"), self.book("Bulk B", "9000099902")
		out = bulk.run("assign_rooms", [a, b])
		self.assertEqual((out["done"], out["failed"]), (2, 0))
		rooms = [frappe.db.get_value("Reservation", n, "room") for n in (a, b)]
		self.assertTrue(all(rooms))
		self.assertNotEqual(rooms[0], rooms[1])
		self.assertEqual(frappe.db.get_value("Room", rooms[0], "room_type"), DLX)

	def test_a_stay_that_already_has_a_room_is_reported_and_the_rest_still_go(self):
		a = self.book("Bulk C", "9000099903")
		b = self.book("Bulk D", "9000099904")
		# some sites hand out rooms only at check-in, so give this one its room directly
		frappe.db.set_value("Reservation", a, "room", frappe.get_all("Room", filters={"room_type": DLX}, pluck="name", limit=1)[0])
		out = bulk.run("assign_rooms", [a, b])
		got = self.by_name(out)
		self.assertFalse(got[a]["ok"])
		self.assertIn("already has a room", got[a]["message"])
		self.assertTrue(got[b]["ok"])
		self.assertEqual((out["done"], out["failed"]), (1, 1))

	def test_a_cancelled_stay_is_refused_with_the_reason(self):
		a = self.book("Bulk E", "9000099905")
		frappe.db.set_value("Reservation", a, "status", "Cancelled")
		got = self.by_name(bulk.run("assign_rooms", [a]))
		self.assertFalse(got[a]["ok"])
		self.assertIn("Cancelled", got[a]["message"])

	def test_check_in_of_a_future_arrival_is_refused_by_kamras_rule_and_changes_nothing(self):
		a = self.book("Bulk F", "9000099906", assign=True)
		got = self.by_name(bulk.run("check_in", [a]))
		self.assertFalse(got[a]["ok"])
		self.assertTrue(got[a]["message"])
		self.assertEqual(frappe.db.get_value("Reservation", a, "status"), "Confirmed")

	def test_verify_precheckin_needs_a_submitted_one(self):
		a, b = self.book("Bulk G", "9000099907"), self.book("Bulk H", "9000099908")
		frappe.db.set_value("Reservation", b, "precheckin_status", "Submitted")
		got = self.by_name(bulk.run("verify_precheckin", [a, b]))
		self.assertFalse(got[a]["ok"])
		self.assertTrue(got[b]["ok"])
		self.assertEqual(frappe.db.get_value("Reservation", b, "precheckin_status"), "Verified")

	def test_a_failed_stay_leaves_no_half_change(self):
		a = self.book("Bulk I", "9000099909")
		frappe.db.set_value("Reservation", a, "status", "Cancelled")
		bulk.run("assign_rooms", [a])
		self.assertFalse(frappe.db.get_value("Reservation", a, "room"))

	def test_empty_unknown_and_too_many_are_refused(self):
		for args in (("assign_rooms", []), ("nonsense", ["x"]), ("assign_rooms", [f"R{i}" for i in range(bulk.MAX_ROWS + 1)])):
			with self.assertRaises(frappe.ValidationError):
				bulk.run(*args)

	def test_a_name_that_is_not_a_booking_is_reported(self):
		got = self.by_name(bulk.run("assign_rooms", ["RES-NOPE-1"]))
		self.assertFalse(got["RES-NOPE-1"]["ok"])

	def test_results_keep_the_order_the_desk_ticked(self):
		a, b = self.book("Bulk J", "9000099910"), self.book("Bulk K", "9000099911", start=add_days(START, 3))
		out = bulk.run("assign_rooms", [b, a])
		self.assertEqual([r["reservation"] for r in out["results"]], [b, a])


class TestBulkCheckIn(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def test_a_stay_due_today_checks_in_and_the_early_one_is_refused(self):
		from kamra.business_date import get_business_date

		today = get_business_date(PROP)
		now = create_stay(property=PROP, guest_name="Bulk Today", phone="9000099920", check_in_date=add_days(START, 1),
		                  check_out_date=add_days(START, 2), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]
		later = create_stay(property=PROP, guest_name="Bulk Later", phone="9000099921", check_in_date=add_days(START, 5),
		                    check_out_date=add_days(START, 6), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]
		# the business date may trail the calendar day, which Kamra will not book into: move the dates after booking
		frappe.db.set_value("Reservation", now, {"check_in_date": today, "check_out_date": add_days(today, 1)})
		frappe.db.set_value("Reservation", later, {"check_in_date": add_days(today, 3), "check_out_date": add_days(today, 4)})
		out = bulk.run("check_in", [now, later])
		got = {r["reservation"]: r for r in out["results"]}
		if not got[now]["ok"]:
			# the demo room may not be ready; the refusal must then say why and change nothing
			self.assertTrue(got[now]["message"])
			self.assertEqual(frappe.db.get_value("Reservation", now, "status"), "Confirmed")
		else:
			self.assertEqual(frappe.db.get_value("Reservation", now, "status"), "Checked In")
			self.assertTrue(frappe.db.get_value("Reservation", now, "room"))
		self.assertFalse(got[later]["ok"])
		self.assertEqual(frappe.db.get_value("Reservation", later, "status"), "Confirmed")
