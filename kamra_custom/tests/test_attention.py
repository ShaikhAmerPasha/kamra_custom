"""The attention list finds what is wrong now, and the snapshot rows carry what blocks the desk."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import attention, overrides

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestAttention(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.room = frappe.db.get_value(
			"Room", {"room_type": DLX, "occupancy_status": "Vacant", "housekeeping_status": "Clean"})
		if not self.room:
			self.skipTest("no free Deluxe room on this site")

	def tearDown(self):
		frappe.db.rollback()

	def book(self, **kw):
		from kamra.api import create_booking

		args = dict(property=PROP, room_type=DLX, check_in_date=nowdate(),
		            check_out_date=add_days(nowdate(), 1), guest_name="Attention Test",
		            phone="9000077704", adults=1)
		args.update(kw)
		return create_booking(**args)["reservation"]

	def group(self, key):
		return next((g for g in attention.attention(PROP)["groups"] if g["key"] == key), None)

	def test_arrival_without_a_room_is_listed(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "room", None)
		g = self.group("no_room")
		self.assertIsNotNone(g)
		self.assertIn(name, [i["reservation"] for i in g["items"]] if g["count"] <= attention.SHOW else [name])

	def test_arrival_into_a_dirty_room_is_listed(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "room", self.room)
		frappe.db.set_value("Room", self.room, "housekeeping_status", "Dirty")
		g = self.group("not_ready")
		self.assertIsNotNone(g)
		self.assertTrue(any(i["reservation"] == name for i in g["items"]))
		self.assertIn("dirty", [i["detail"] for i in g["items"] if i["reservation"] == name][0])

	def test_a_missed_arrival_is_listed_for_no_show(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, "check_in_date", add_days(nowdate(), -1))
		g = self.group("no_show")
		self.assertTrue(g and any(i["reservation"] == name for i in g["items"]))

	def test_total_is_the_sum_of_the_groups(self):
		out = attention.attention(PROP)
		self.assertEqual(out["total"], sum(g["count"] for g in out["groups"]))

	def test_snapshot_rows_carry_id_and_time_flags(self):
		name = self.book()
		frappe.db.set_value("Reservation", name, {"planned_check_in_time": "15:30:00"})
		snap = overrides.front_desk_snapshot(property=PROP)
		row = next(r for r in snap["arrivals"] if r["name"] == name)
		self.assertTrue(row["id_missing"])
		self.assertEqual(row["planned_check_in_time"], "15:30")
		self.assertIn("vip", row)
		self.assertIn("paid_total", row)

	def test_snapshot_keeps_everything_kamras_own_screens_read(self):
		from kamra.api import front_desk_snapshot as kamras

		self.book()
		ours = overrides.front_desk_snapshot(property=PROP)
		theirs = kamras(property=PROP)
		self.assertEqual(set(theirs), set(ours))
		for key in ("arrivals", "in_house", "departures"):
			self.assertEqual(len(ours[key]), len(theirs[key]))
			for a, b in zip(ours[key], theirs[key]):
				for field, value in b.items():
					self.assertEqual(a[field], value, field)
		self.assertEqual(ours["rooms"], theirs["rooms"])
