"""Folio routing rules: saved on the stay, applied with Kamra's own transfer."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra_custom import routing
from kamra_custom.booking import create_stay
from kamra_custom.setup import ensure_schema

PROP = "SR Continental"
DLX = "SR Continental-DLX"
START = add_days(nowdate(), 180)


class TestRouting(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", DLX):
			self.skipTest("demo property not on this site")
		ensure_schema()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def stay_with_charges(self):
		from kamra.folio import _recalculate, open_folio

		name = create_stay(property=PROP, guest_name="Route Guest", phone="9000055590", check_in_date=START,
		                   check_out_date=add_days(START, 2), rooms=[{"room_type": DLX}])["reservations"][0]["reservation"]
		res = frappe.get_doc("Reservation", name)
		folio = frappe.get_doc("Folio", open_folio(res))
		for i, (ct, amt) in enumerate((("Room", 1000), ("Food & Beverage", 400), ("Laundry", 150))):
			folio.append("charges", {"posting_date": nowdate(), "stay_date": add_days(START, i % 2), "charge_type": ct,
			                         "description": ct, "qty": 1, "rate": amt, "amount": amt, "gst_rate": 5, "gst_amount": amt * 0.05,
			                         "total": amt * 1.05, "reservation": name})
		_recalculate(folio)
		folio.save(ignore_permissions=True)
		return name, folio.name

	def test_rules_are_kept_and_nothing_moves_until_applied(self):
		name, folio = self.stay_with_charges()
		out = routing.save(name, [{"charge_type": "Food & Beverage", "target": "Extra"}])
		self.assertEqual(out["routes"][0]["target"], "Extra")
		self.assertEqual([p["charge_type"] for p in out["pending"]], ["Food & Beverage"])
		self.assertEqual(len(frappe.get_doc("Folio", folio).charges), 3)

	def test_apply_moves_only_the_matching_charge_to_the_extra_folio(self):
		name, folio = self.stay_with_charges()
		routing.save(name, [{"charge_type": "Food & Beverage", "target": "Extra"}])
		out = routing.apply(name)
		self.assertEqual((out["done"], out["failed"], out["pending"]), (1, 0, 0))
		self.assertEqual(sorted(c.charge_type for c in frappe.get_doc("Folio", folio).charges), ["Laundry", "Room"])
		extra = frappe.get_all("Folio", filters={"reservation": name, "folio_type": "Extra"}, pluck="name")
		self.assertEqual(len(extra), 1)
		self.assertEqual([c.charge_type for c in frappe.get_doc("Folio", extra[0]).charges], ["Food & Beverage"])

	def test_the_total_billed_does_not_change(self):
		name, folio = self.stay_with_charges()
		before = frappe.db.get_value("Folio", folio, "grand_total")
		routing.save(name, [{"charge_type": "Room", "target": "Extra"}, {"charge_type": "Laundry", "target": "Extra"}])
		routing.apply(name)
		after = sum(frappe.get_all("Folio", filters={"reservation": name}, pluck="grand_total"))
		self.assertAlmostEqual(before, after, places=2)

	def test_a_date_range_limits_a_rule(self):
		name, folio = self.stay_with_charges()
		day = str(START)  # the Room charge of the fixture is dated the arrival day
		routing.save(name, [{"charge_type": "Room", "target": "Extra", "date_from": day, "date_to": day}])
		other = str(add_days(START, 1))
		self.assertEqual(routing.save(name, [{"charge_type": "Room", "target": "Extra", "date_from": other, "date_to": other}])["pending"], [])
		routing.save(name, [{"charge_type": "Room", "target": "Extra", "date_from": day, "date_to": day}])
		got = routing.get(name)["pending"]
		self.assertEqual([p["stay_date"] for p in got], [day])

	def test_the_first_rule_that_fits_wins(self):
		name, _folio = self.stay_with_charges()
		routing.save(name, [{"charge_type": "Room", "target": "Extra", "date_from": str(START), "date_to": str(START)},
		                    {"charge_type": "Room", "target": "Guest"}])
		self.assertEqual(routing.get(name)["pending"][0]["target"], "Extra")

	def test_applying_twice_changes_nothing_more(self):
		name, _folio = self.stay_with_charges()
		routing.save(name, [{"charge_type": "Laundry", "target": "Extra"}])
		routing.apply(name)
		again = routing.apply(name)
		self.assertEqual((again["done"], again["failed"], again["pending"]), (0, 0, 0))

	def test_bad_rules_are_refused(self):
		name, _folio = self.stay_with_charges()
		for bad in ([{"charge_type": "Nope", "target": "Extra"}], [{"charge_type": "Room", "target": "Moon"}],
		            [{"charge_type": "Room", "target": "Company"}], [{"charge_type": "Room", "target": "Group"}],
		            [{"charge_type": "Room", "target": "Extra", "date_from": "2026-12-05", "date_to": "2026-12-01"}],
		            [{"charge_type": "Room", "target": "Extra"}, {"charge_type": "Room", "target": "Guest"}],
		            [{"charge_type": "Room", "target": "Extra", "date_from": "not a date"}]):
			if len(bad) == 2 and bad[0]["charge_type"] == bad[1]["charge_type"] and not bad[0].get("date_from"):
				with self.assertRaises(frappe.ValidationError, msg=str(bad)):
					routing.save(name, bad)
				continue
			with self.assertRaises(frappe.ValidationError, msg=str(bad)):
				routing.save(name, bad)

	def test_a_closed_stay_cannot_change(self):
		name, _folio = self.stay_with_charges()
		frappe.db.set_value("Reservation", name, "status", "Cancelled")
		with self.assertRaises(frappe.ValidationError):
			routing.save(name, [{"charge_type": "Room", "target": "Extra"}])
		with self.assertRaises(frappe.ValidationError):
			routing.apply(name)

	def test_clearing_the_rules_leaves_nothing_pending(self):
		name, _folio = self.stay_with_charges()
		routing.save(name, [{"charge_type": "Room", "target": "Extra"}])
		self.assertEqual(routing.save(name, [])["pending"], [])
