"""The day-by-day rate editor: what the panel reads from the preview, and that a discount it works out
is held night by night under the usual approver rule."""

import frappe
from frappe.utils import add_days, nowdate

from kamra_custom import negotiation
from kamra_custom.tests.test_negotiation import PROP, RT, _Site


class TestDayRates(_Site):
	def book(self, nights=3):
		from kamra.api import create_booking

		start = add_days(nowdate(), 70)
		return create_booking(
			property=PROP, room_type=RT, check_in_date=start, check_out_date=add_days(start, nights),
			guest_name="Day Rates", phone="9000012399",
		)["reservation"]

	def test_preview_gives_one_system_price_per_night(self):
		res = frappe.get_doc("Reservation", self.book(3))
		p = negotiation.preview(PROP, RT, str(res.check_in_date), str(res.check_out_date))
		self.assertEqual(len(p["entry_rates"]), 3)
		self.assertIn("meal_per_night", p)
		self.assertIn("inclusive", p)

	def test_a_percent_discount_is_held_night_by_night(self):
		name = self.book(3)
		res = frappe.get_doc("Reservation", name)
		p = negotiation.preview(PROP, RT, str(res.check_in_date), str(res.check_out_date))
		if p["inclusive"]:
			self.skipTest("rates here are typed with tax in them")
		system = [round(r + p["meal_per_night"], 2) for r in p["entry_rates"]]
		agreed = [round(s * 0.95, 2) for s in system]
		negotiation.set_negotiated_rate(name, agreed, "Day-wise discount", "Front Office", all_in=1)
		res.reload()
		self.assertEqual(res.rate_negotiated, 1)
		held = [round(r.rate + (r.meal_amount or 0), 2) for r in res.night_rates]
		for want, got in zip(agreed, held):
			self.assertAlmostEqual(want, got, places=1)
		self.assertEqual(len(res.night_rates), 3)

	def test_a_different_price_each_night_is_kept(self):
		name = self.book(3)
		negotiation.set_negotiated_rate(name, [2500, 2600, 2700], "Weekend step", "Front Office")
		res = frappe.get_doc("Reservation", name)
		self.assertEqual([round(r.rate) for r in res.night_rates], [2500, 2600, 2700])

	def test_a_discount_still_needs_an_approver(self):
		name = self.book(2)
		with self.assertRaises(frappe.ValidationError):
			negotiation.set_negotiated_rate(name, [1800, 1800], "", "")
