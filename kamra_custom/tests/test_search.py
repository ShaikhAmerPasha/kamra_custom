"""The reservation search screen: status choices, filters and shortcuts."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import reservations
from kamra_custom.booking import create_stay

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 140)


class TestReservationSearch(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def book(self, name="Search Subject", phone="9000066601", start=START, nights=2):
		return create_stay(property=PROP, guest_name=name, phone=phone, check_in_date=start,
		                   check_out_date=add_days(start, nights), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]

	def names(self, **kw):
		kw.setdefault("status", "all")
		return [r["name"] for r in reservations.search(PROP, **kw)["rows"]]

	def test_status_choices_split_the_stays(self):
		a = self.book(name="Alpha Status")
		b = self.book(name="Bravo Status", phone="9000066602")
		frappe.db.set_value("Reservation", b, "status", "Cancelled")
		self.assertIn(a, self.names(status="reserved", name="Status"))
		self.assertNotIn(b, self.names(status="reserved", name="Status"))
		self.assertIn(b, self.names(status="cancelled", name="Status"))
		self.assertIn(a, self.names(status="all", name="Status"))
		self.assertIn(b, self.names(status="all", name="Status"))

	def test_hold_and_in_house_and_no_show_are_their_own_choices(self):
		a = self.book(name="Charlie Hold")
		frappe.db.set_value("Reservation", a, "status", "Held")
		self.assertIn(a, self.names(status="hold", name="Charlie"))
		frappe.db.set_value("Reservation", a, "status", "Checked In")
		self.assertIn(a, self.names(status="in_house", name="Charlie"))
		frappe.db.set_value("Reservation", a, "status", "No Show")
		self.assertIn(a, self.names(status="no_show", name="Charlie"))

	def test_filters_narrow_the_result(self):
		a = self.book(name="Delta Filter", phone="9000066603")
		b = self.book(name="Echo Filter", phone="9000066604", start=add_days(START, 5))
		self.assertEqual(sorted(set(self.names(name="Filter")) & {a, b}), sorted([a, b]))
		self.assertEqual(self.names(name="Filter", date=START), [a])
		self.assertEqual(self.names(name="Filter", date=add_days(START, 7), date_in="departure"), [b])
		self.assertEqual(self.names(phone="+91 90000 66604"), [b])
		self.assertEqual(self.names(reservation=a), [a])
		self.assertEqual(self.names(room_type=DLX, name="Delta"), [a])
		self.assertEqual(self.names(name="Delta", room_type="no-such-type"), [])

	def test_arrivals_shortcuts_follow_the_business_date(self):
		from kamra.business_date import get_business_date
		today = get_business_date(PROP)
		now = self.book(name="Foxtrot Today", start=today, phone="9000066605")
		soon = self.book(name="Golf Soon", start=add_days(today, 2), phone="9000066606")
		later = self.book(name="Hotel Later", start=add_days(today, 3), phone="9000066607")
		self.assertIn(now, self.names(shortcut="arrivals_today"))
		self.assertNotIn(soon, self.names(shortcut="arrivals_today"))
		in3 = self.names(shortcut="arrivals_3_days")
		self.assertIn(now, in3)
		self.assertIn(soon, in3)
		self.assertNotIn(later, in3)

	def test_no_shows_of_the_last_three_days(self):
		from kamra.business_date import get_business_date
		today = get_business_date(PROP)
		recent = self.book(name="India Missed", phone="9000066608")
		old = self.book(name="Juliet Missed", phone="9000066609")
		# Kamra refuses a booking in the past, so move the dates after booking.
		for n, back in ((recent, 2), (old, 9)):
			frappe.db.set_value("Reservation", n, {
				"status": "No Show", "check_in_date": add_days(today, -back),
				"check_out_date": add_days(today, -back + 1)})
		got = self.names(shortcut="no_shows_3_days")
		self.assertIn(recent, got)
		self.assertNotIn(old, got)

	def test_row_carries_balance_and_deposit_like_the_board(self):
		from kamra.api import _stay_balances
		a = self.book(name="Kilo Balance", phone="9000066610")
		row = reservations.search(PROP, status="all", name="Kilo")["rows"][0]
		self.assertEqual(row["balance"], _stay_balances([a])[a]["due"])
		self.assertEqual(row["deposit"], float(frappe.db.get_value("Reservation", a, "advance_paid") or 0))
		self.assertEqual(row["phone"], frappe.db.get_value("Guest", row["guest"], "phone"))

	def test_unknown_status_and_shortcut_are_refused(self):
		with self.assertRaises(frappe.ValidationError):
			reservations.search(PROP, status="nonsense")
		with self.assertRaises(frappe.ValidationError):
			reservations.search(PROP, shortcut="nonsense")

	def test_sort_and_limit(self):
		self.book(name="Lima Sort", phone="9000066611")
		self.book(name="Mike Sort", phone="9000066612")
		asc = [r["guest_name"] for r in reservations.search(PROP, status="all", name="Sort")["rows"]]
		desc = [r["guest_name"] for r in reservations.search(PROP, status="all", name="Sort", descending=1)["rows"]]
		self.assertEqual(asc, list(reversed(desc)))
		res = reservations.search(PROP, status="all", name="Sort", limit=1)
		self.assertEqual(len(res["rows"]), 1)
		self.assertTrue(res["truncated"])
