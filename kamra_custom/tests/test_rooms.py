import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import rooms

PROP = "SR Continental"


class TestOutOfOrder(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		free = frappe.db.sql(
			"""select r.name from `tabRoom` r where r.property = %s and r.housekeeping_status = 'Clean'
			   and not exists (select 1 from `tabReservation` x where x.room = r.name and x.status in ('Confirmed','Checked In'))
			   and not exists (select 1 from `tabRoom Block` b where b.room = r.name and b.block_status = 'Active') limit 1""",
			PROP,
		)
		if not free:
			self.skipTest("no free clean room on this site")
		self.room = free[0][0]

	def tearDown(self):
		frappe.db.rollback()

	def test_out_of_order_needs_a_reason(self):
		with self.assertRaises(frappe.ValidationError):
			rooms.take_out_of_order(self.room, "  ", add_days(nowdate(), 2))

	def test_out_of_order_needs_a_date(self):
		with self.assertRaises(frappe.ValidationError):
			rooms.take_out_of_order(self.room, "AC repair", "")

	def test_the_date_cannot_be_in_the_past(self):
		with self.assertRaises(frappe.ValidationError):
			rooms.take_out_of_order(self.room, "AC repair", add_days(nowdate(), -1))

	def test_the_reason_and_date_are_kept_on_a_room_block(self):
		out = rooms.take_out_of_order(self.room, "AC repair", add_days(nowdate(), 3))
		self.assertEqual(frappe.db.get_value("Room", self.room, "housekeeping_status"), "Out of Order")
		block = frappe.db.get_value("Room Block", out["block"], ["note", "to_date", "block_status", "room"], as_dict=True)
		self.assertEqual(block.note, "AC repair")
		self.assertEqual(str(block.to_date), add_days(nowdate(), 3))
		self.assertEqual(block.room, self.room)

	def test_one_click_out_of_order_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			rooms.set_housekeeping_status(self.room, "Out of Order")
		self.assertEqual(frappe.db.get_value("Room", self.room, "housekeeping_status"), "Clean")

	def test_other_statuses_still_work_as_before(self):
		rooms.set_housekeeping_status(self.room, "Dirty")
		self.assertEqual(frappe.db.get_value("Room", self.room, "housekeeping_status"), "Dirty")

	def test_with_a_hold_in_place_the_status_call_is_allowed(self):
		rooms.take_out_of_order(self.room, "AC repair", add_days(nowdate(), 3))
		rooms.set_housekeeping_status(self.room, "Dirty")
		rooms.set_housekeeping_status(self.room, "Out of Order")
		self.assertEqual(frappe.db.get_value("Room", self.room, "housekeeping_status"), "Out of Order")
