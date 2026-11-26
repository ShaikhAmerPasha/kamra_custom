"""Sending a master field of a group down to its rooms."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import groups_desk
from kamra_custom.setup import ensure_schema

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 170)


class TestGroupsDesk(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		ensure_schema()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def group(self, rooms=3):
		from kamra.api import create_group_booking

		out = create_group_booking(
			property=PROP, group_name="Desk Group", check_in_date=START, check_out_date=add_days(START, 2),
			rooms=[{"room_type": DLX, "count": rooms}], guest_name="Desk Leader", phone="9000066690",
		)
		return out["group_booking"], out["created"]

	def test_values_go_to_the_ticked_rooms_only(self):
		gb, rooms = self.group()
		out = groups_desk.download(gb, rooms[:2], {"pay_by": "Company", "gst_number": "33abcde1234f1z5", "special_guest": 1, "market_segment": "Corporate"})
		self.assertEqual((out["done"], out["failed"]), (2, 0))
		for n in rooms[:2]:
			v = frappe.db.get_value("Reservation", n, ["pay_by", "gst_number", "special_guest", "market_segment"], as_dict=True)
			self.assertEqual((v.pay_by, v.gst_number, v.special_guest, v.market_segment), ("Company", "33ABCDE1234F1Z5", 1, "Corporate"))
		self.assertFalse(frappe.db.get_value("Reservation", rooms[2], "pay_by"))

	def test_a_cancelled_room_is_reported_and_the_rest_go(self):
		gb, rooms = self.group()
		frappe.db.set_value("Reservation", rooms[0], "status", "Cancelled")
		out = groups_desk.download(gb, rooms, {"pay_by": "Card"})
		got = {r["reservation"]: r for r in out["results"]}
		self.assertFalse(got[rooms[0]]["ok"])
		self.assertIn("Cancelled", got[rooms[0]]["message"])
		self.assertTrue(got[rooms[1]]["ok"] and got[rooms[2]]["ok"])
		self.assertEqual((out["done"], out["failed"]), (2, 1))

	def test_a_room_of_another_group_is_refused(self):
		gb, rooms = self.group()
		_gb2, other = self.group(1)
		got = {r["reservation"]: r for r in groups_desk.download(gb, [other[0]], {"pay_by": "Card"})["results"]}
		self.assertFalse(got[other[0]]["ok"])

	def test_bad_values_and_fields_are_refused(self):
		gb, rooms = self.group()
		for bad in ({"gst_number": "1"}, {"market_segment": "Nope"}, {"amount_after_tax": 1}, {"credit_limit": "-3"}):
			with self.assertRaises(frappe.ValidationError, msg=str(bad)):
				groups_desk.download(gb, rooms, bad)
		for args in (([], {"pay_by": "Card"}), (rooms, {})):
			with self.assertRaises(frappe.ValidationError):
				groups_desk.download(gb, *args)

	def test_it_does_not_touch_the_money(self):
		gb, rooms = self.group()
		before = [frappe.db.get_value("Reservation", n, "amount_after_tax") for n in rooms]
		groups_desk.download(gb, rooms, {"tax_exempt": 1, "pay_by": "Cash"})
		self.assertEqual(before, [frappe.db.get_value("Reservation", n, "amount_after_tax") for n in rooms])

	def test_a_blank_value_clears_the_field(self):
		gb, rooms = self.group()
		groups_desk.download(gb, rooms, {"gst_number": "33ABCDE1234F1Z5"})
		groups_desk.download(gb, rooms, {"gst_number": ""})
		self.assertFalse(frappe.db.get_value("Reservation", rooms[0], "gst_number"))
