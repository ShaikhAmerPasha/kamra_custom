"""Phases 5 and 6: one call books the stay, the rooms, the remarks, the agreed
rates and the advance, or nothing at all."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom.booking import create_stay, find_guest_by_phone

PROP = "SR Continental"
DLX = "SR Continental-DLX"
PRM = "SR Continental-PRM"
START = add_days(nowdate(), 90)
END = add_days(START, 2)


class TestCreateStay(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_document_cache("Property", PROP)

	def stay(self, rooms, **kw):
		args = dict(property=PROP, guest_name="Stay Test", phone="9000077701",
		            check_in_date=START, check_out_date=END, rooms=rooms)
		args.update(kw)
		return create_stay(**args)

	def test_one_room(self):
		out = self.stay([{"room_type": DLX, "adults": 2, "children": 1}])
		self.assertEqual(len(out["reservations"]), 1)
		self.assertIsNone(out["group_booking"])
		res = frappe.get_doc("Reservation", out["reservations"][0]["reservation"])
		self.assertEqual((res.adults, res.children), (2, 1))

	def test_each_added_room_has_its_own_adults_and_children(self):
		out = self.stay([
			{"room_type": DLX, "adults": 2, "children": 1},
			{"room_type": PRM, "adults": 2, "children": 0},
		])
		got = [frappe.db.get_value("Reservation", r["reservation"], ["adults", "children", "room_type"], as_dict=True)
		       for r in out["reservations"]]
		self.assertEqual([(g.adults, g.children) for g in got], [(2, 1), (2, 0)])
		self.assertEqual([g.room_type for g in got], [DLX, PRM])
		self.assertTrue(out["group_booking"])

	def test_rooms_share_the_guest_and_the_remarks(self):
		out = self.stay(
			[{"room_type": DLX}, {"room_type": PRM}],
			booking_instructions="Late arrival, keep dinner",
			internal_remarks="Advance Rs 5000 taken by cash",
			booking_ref="PNR12345",
		)
		docs = [frappe.get_doc("Reservation", r["reservation"]) for r in out["reservations"]]
		self.assertEqual(len({d.guest for d in docs}), 1)
		for d in docs:
			self.assertEqual(d.special_requests, "Late arrival, keep dinner")
			self.assertEqual(d.internal_remarks, "Advance Rs 5000 taken by cash")
			self.assertEqual(d.ota_ref, "PNR12345")
			self.assertEqual(d.group_booking, out["group_booking"])

	def test_an_existing_guest_is_reused_whatever_the_phone_format(self):
		first = self.stay([{"room_type": DLX}], phone="9000077702")
		g1 = first["guest"]
		self.assertEqual(find_guest_by_phone("+91 90000 77702", PROP), g1)
		again = self.stay(
			[{"room_type": DLX}], phone="+91 90000 77702",
			check_in_date=add_days(START, 10), check_out_date=add_days(START, 12),
		)
		self.assertEqual(again["guest"], g1)
		self.assertEqual(frappe.db.count("Guest", {"phone_key": "919000077702"}), 1)

	def test_a_picked_guest_is_attached(self):
		g = frappe.get_doc({"doctype": "Guest", "first_name": "Picked", "phone": "9000077703"}).insert()
		out = self.stay([{"room_type": DLX}], guest=g.name, guest_name="Picked", phone="9000077703")
		self.assertEqual(out["guest"], g.name)

	def test_agreed_rate_per_room(self):
		out = self.stay([
			{"room_type": DLX, "rates": [2100, 2100], "reason": "Bargained at desk", "approver": "GM Sir"},
			{"room_type": PRM},
		])
		a, b = [frappe.get_doc("Reservation", r["reservation"]) for r in out["reservations"]]
		self.assertEqual((a.auto_price, a.rate_negotiated), (0, 1))
		self.assertAlmostEqual(a.amount_before_tax, 4200, places=1)
		self.assertEqual((b.auto_price, b.rate_negotiated), (1, 0))

	def test_a_big_discount_by_the_desk_books_nothing(self):
		from kamra.tests.fixtures import ensure_roles_and_users

		ensure_roles_and_users()
		before = frappe.db.count("Reservation")
		frappe.set_user("banquet.sales@test.local")
		with self.assertRaises(frappe.PermissionError):
			self.stay([{"room_type": DLX, "rates": [1900, 1900], "reason": "x", "approver": "MD Sir"}])
		frappe.db.rollback()
		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.count("Reservation"), before)

	def test_if_one_room_fails_none_are_booked(self):
		before = frappe.db.count("Reservation")
		with self.assertRaises(frappe.ValidationError):
			self.stay([{"room_type": DLX}, {"room_type": "No Such Room Type"}])
		frappe.db.rollback()
		self.assertEqual(frappe.db.count("Reservation"), before)

	def test_advance_is_linked_to_the_stay_and_its_folio(self):
		out = self.stay([{"room_type": DLX}], advance_amount=500, advance_mode="Cash", advance_reference="slip 7")
		name = out["reservations"][0]["reservation"]
		self.assertEqual(out["advance"]["amount"], 500)
		self.assertEqual(frappe.db.get_value("Reservation", name, "advance_paid"), 500)
		pay = frappe.get_all("Folio Payment", filters={"payment_kind": "Advance", "reference": "slip 7"},
		                     fields=["parent", "amount", "mode"])
		self.assertEqual([(p.amount, p.mode) for p in pay], [(500, "Cash")])
		self.assertEqual(frappe.db.get_value("Folio", pay[0].parent, "reservation"), name)

	def test_no_advance_when_the_amount_is_zero(self):
		out = self.stay([{"room_type": DLX}], advance_amount=0)
		self.assertIsNone(out["advance"])

	def test_room_capacity_rule_still_applies(self):
		with self.assertRaisesRegex(frappe.ValidationError, "sleeps"):
			self.stay([{"room_type": PRM, "adults": 3, "children": 2}])

	def test_input_checks(self):
		for rooms in ([], [{"adults": 2}], [{"room_type": DLX, "adults": 0}], [{"room_type": DLX, "children": -1}]):
			with self.assertRaises(frappe.ValidationError):
				self.stay(rooms)

	def test_kamra_functions_we_call_still_have_these_arguments(self):
		import inspect

		from kamra.api import create_booking, record_advance

		have = set(inspect.signature(create_booking).parameters)
		for a in ("property", "room_type", "check_in_date", "check_out_date", "guest_name", "phone", "adults",
		          "children", "meal_plan", "booking_type", "company", "group_booking", "source", "travel_agent",
		          "guest", "check_in_time", "check_out_time"):
			self.assertIn(a, have, a)
		self.assertTrue({"reservation", "amount", "mode", "reference", "pin"} <= set(inspect.signature(record_advance).parameters))
		self.assertTrue(frappe.get_meta("Reservation").has_field("ota_ref"))
		self.assertTrue(frappe.get_meta("Reservation").has_field("special_requests"))
