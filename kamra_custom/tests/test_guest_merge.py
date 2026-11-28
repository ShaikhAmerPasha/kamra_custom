"""Merging a duplicate guest profile into the one to keep."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import guest_merge

PROP = "SR Continental"
DLX = "SR Continental-DLX"


class TestGuestMerge(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.tag = frappe.generate_hash(length=6)
		self.name = f"Zz Dup {self.tag}"

	def tearDown(self):
		frappe.db.rollback()

	def guest(self, phone=None, email=None, **kw):
		d = frappe.get_doc({"doctype": "Guest", "first_name": self.name, "full_name": self.name,
		                    "phone": phone, "email": email, **kw})
		d.insert(ignore_permissions=True)
		return d.name

	def book(self, guest):
		from kamra.api import create_booking

		res = create_booking(property=PROP, room_type=DLX, check_in_date=add_days(nowdate(), 30),
		                     check_out_date=add_days(nowdate(), 31), guest_name=self.name,
		                     phone=f"9000{int(frappe.generate_hash(length=6)[:6], 16) % 900000 + 100000}", adults=1)["reservation"]
		frappe.db.set_value("Reservation", res, "guest", guest)
		return res

	def test_duplicates_are_found_by_name_ignoring_case_and_spaces(self):
		a = self.guest(phone="+919000055501")
		b = frappe.get_doc({"doctype": "Guest", "first_name": self.name.upper()}).insert(ignore_permissions=True).name
		groups = guest_merge.duplicates(PROP)
		g = next(g for g in groups if {m["name"] for m in g["members"]} == {a, b})
		self.assertEqual(g["keep"], a)  # the one with a phone
		self.assertTrue(g["can_merge"])

	def test_different_phones_block_the_merge(self):
		a = self.guest(phone="+919000055502")
		b = self.guest(phone="+919000055503")
		g = next(g for g in guest_merge.duplicates(PROP) if {m["name"] for m in g["members"]} == {a, b})
		self.assertFalse(g["can_merge"])
		self.assertIn("phone", g["blocked"].lower())
		with self.assertRaises(frappe.ValidationError):
			guest_merge.merge(a, b, "same person")

	def test_merge_moves_bookings_and_fills_blanks(self):
		keep = self.guest(phone="+919000055504")
		gone = self.guest(email="g@example.com", nationality="Indian", vip=1)
		res = self.book(gone)
		out = guest_merge.merge(keep, gone, "typed twice at the desk")
		self.assertEqual(frappe.db.get_value("Reservation", res, "guest"), keep)
		self.assertFalse(frappe.db.exists("Guest", gone))
		k = frappe.get_doc("Guest", keep)
		self.assertEqual(k.email, "g@example.com")
		self.assertEqual(k.nationality, "Indian")
		self.assertTrue(k.vip)
		self.assertEqual(out["bookings_moved"], 1)

	def test_the_keepers_own_values_win(self):
		keep = self.guest(phone="+919000055505", email="keep@example.com")
		gone = self.guest(email="gone@example.com")
		guest_merge.merge(keep, gone, "dup")
		self.assertEqual(frappe.db.get_value("Guest", keep, "email"), "keep@example.com")

	def test_a_blacklist_is_never_lost(self):
		keep = self.guest(phone="+919000055506")
		gone = self.guest(blacklisted=1, blacklist_reason="damage")
		guest_merge.merge(keep, gone, "dup")
		k = frappe.get_doc("Guest", keep)
		self.assertTrue(k.blacklisted)
		self.assertIn("damage", k.blacklist_reason)

	def test_the_merge_is_written_on_the_kept_profile(self):
		keep = self.guest(phone="+919000055507")
		gone = self.guest()
		guest_merge.merge(keep, gone, "dup reason")
		notes = frappe.get_all("Comment", filters={"reference_doctype": "Guest", "reference_name": keep, "content": ("like", "Merged%")}, pluck="content")
		self.assertTrue(notes)
		self.assertIn(gone, notes[0])
		self.assertIn("dup reason", notes[0])

	def test_a_reason_is_needed_and_a_guest_cannot_merge_into_itself(self):
		a = self.guest()
		b = self.guest()
		with self.assertRaises(frappe.ValidationError):
			guest_merge.merge(a, b, "  ")
		with self.assertRaises(frappe.ValidationError):
			guest_merge.merge(a, a, "x")

	def test_a_checked_in_guest_is_refused(self):
		keep = self.guest(phone="+919000055508")
		gone = self.guest()
		res = self.book(gone)
		frappe.db.set_value("Reservation", res, "status", "Checked In")
		with self.assertRaises(frappe.ValidationError):
			guest_merge.merge(keep, gone, "x")
