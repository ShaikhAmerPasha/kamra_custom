"""Phase 7: negotiated rates. The first tests guard the one risky thing here:
our tax maths must agree with Kamra's `quote()` when no rate is changed."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, nowdate

from kamra.pricing import quote
from kamra_custom import negotiation

PROP = "SR Continental"
RT = "SR Continental-DLX"


def _inputs(nights=3, meal_plan=None, adults=2, children=0):
	start = add_days(nowdate(), 60)
	return dict(property=PROP, room_type=RT, check_in_date=start,
	            check_out_date=add_days(start, nights), adults=adults, children=children,
	            meal_plan=meal_plan, rate_plan=None, voucher_code=None)


def _system_rates(q, inclusive):
	"""The rates a desk would type to keep the system price."""
	if not inclusive:
		return [n["rate"] for n in q["nightly"]]
	return [n["rate"] * (1 + n["gst_rate"] / 100) for n in q["nightly"]]


class _Site(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		if not frappe.db.exists("Room Type", RT):
			self.skipTest("demo property not on this site")

	def set_property(self, **values):
		for k, v in values.items():
			frappe.db.set_value("Property", PROP, k, v)
		frappe.clear_document_cache("Property", PROP)

	def tearDown(self):
		# each test starts from the site as it was: bookings from one test
		# must not sell the next one out
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_document_cache("Property", PROP)


class TestRepriceMatchesKamra(_Site):
	def check(self, **inputs):
		q = quote(**_inputs(**inputs), check_voucher_limits=False)
		inclusive = bool(frappe.db.get_value("Property", PROP, "rates_include_tax"))
		neg = negotiation.reprice(q, PROP, RT, _system_rates(q, inclusive))
		for key in ("room_total", "amount_before_tax", "tax_amount", "amount_after_tax", "cleaning_fee", "room_levy"):
			self.assertAlmostEqual(neg[key], q[key], places=2, msg=key)

	def test_plain_stay(self):
		self.check()

	def test_one_night(self):
		self.check(nights=1)

	def test_with_children(self):
		self.check(children=1)

	def test_with_meal_plan(self):
		plan = frappe.db.get_value("Meal Plan", {"property": PROP, "disabled": 0}, "name")
		if not plan:
			self.skipTest("no meal plan")
		self.check(meal_plan=plan)

	def test_tax_inclusive_property(self):
		self.set_property(rates_include_tax=1)
		self.check()

	def test_cleaning_fee_and_room_levy(self):
		self.set_property(cleaning_fee=150, room_levy_percent=2)
		self.check()

	def test_tax_inclusive_with_cleaning_and_levy(self):
		self.set_property(rates_include_tax=1, cleaning_fee=150, room_levy_percent=2)
		self.check()


class TestReprice(_Site):
	def test_lower_rate_lowers_room_total_and_tax(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		neg = negotiation.reprice(q, PROP, RT, [2000, 2000, 2000])
		self.assertAlmostEqual(neg["room_total"], 6000, places=2)
		self.assertLess(neg["amount_after_tax"], q["amount_after_tax"])
		self.assertEqual([n["rate"] for n in neg["nightly"]], [2000, 2000, 2000])

	def test_different_rate_each_night(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		neg = negotiation.reprice(q, PROP, RT, [2000, 2400, 2200])
		self.assertEqual([n["rate"] for n in neg["nightly"]], [2000, 2400, 2200])
		self.assertAlmostEqual(neg["room_total"], 6600, places=2)

	def test_tax_slab_follows_the_rate(self):
		# India's room tax is a slab on the nightly rate
		q = quote(**_inputs(), check_voucher_limits=False)
		low = negotiation.reprice(q, PROP, RT, [1500] * 3)["nightly"][0]["gst_rate"]
		high = negotiation.reprice(q, PROP, RT, [9000] * 3)["nightly"][0]["gst_rate"]
		self.assertLess(low, high)

	def test_wrong_number_of_nights_is_refused(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		with self.assertRaises(frappe.ValidationError):
			negotiation.reprice(q, PROP, RT, [2000, 2000])

	def test_negative_rate_is_refused(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		with self.assertRaises(frappe.ValidationError):
			negotiation.reprice(q, PROP, RT, [2000, -1, 2000])

	def test_discount_pct(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		neg = negotiation.reprice(q, PROP, RT, [r * 0.8 for r in _system_rates(q, False)])
		self.assertAlmostEqual(negotiation.discount_pct(q, neg), 20.0, places=1)
		up = negotiation.reprice(q, PROP, RT, [r * 1.2 for r in _system_rates(q, False)])
		self.assertEqual(negotiation.discount_pct(q, up), 0.0)


class TestRules(_Site):
	def desk_user(self):
		from kamra.tests.fixtures import ensure_roles_and_users

		ensure_roles_and_users()
		return "banquet.sales@test.local"  # a Front Desk persona

	def test_floor_guardrail_blocks_a_rate(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		with self.assertRaisesRegex(frappe.ValidationError, "guardrail"):
			negotiation.check_rules(PROP, RT, q["nightly"], [1000, 1000, 1000], 60)

	def test_desk_cannot_give_a_big_discount(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		frappe.set_user(self.desk_user())
		with self.assertRaises(frappe.PermissionError):
			negotiation.check_rules(PROP, RT, q["nightly"], [2000] * 3, 20)

	def test_desk_can_give_a_small_discount(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		frappe.set_user(self.desk_user())
		negotiation.check_rules(PROP, RT, q["nightly"], [2300] * 3, 8)

	def test_manager_can_give_a_big_discount(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		negotiation.check_rules(PROP, RT, q["nightly"], [2000] * 3, 20)  # Administrator

	def test_limit_comes_from_settings(self):
		frappe.db.set_single_value("Kamra Custom Settings", "max_desk_discount_pct", 25)
		q = quote(**_inputs(), check_voucher_limits=False)
		frappe.set_user(self.desk_user())
		negotiation.check_rules(PROP, RT, q["nightly"], [2000] * 3, 20)

	def test_ceiling_guardrail_blocks_too_high_a_rate(self):
		q = quote(**_inputs(), check_voucher_limits=False)
		with self.assertRaisesRegex(frappe.ValidationError, "guardrail"):
			negotiation.check_rules(PROP, RT, q["nightly"], [9000] * 3, 0)


class TestPreviewWarnsBeforeBooking(_Site):
	def test_rate_below_the_floor_is_flagged_in_the_preview(self):
		i = _inputs()
		out = negotiation.preview(PROP, RT, i["check_in_date"], i["check_out_date"], rates=[545, 545, 545])
		self.assertIn("guardrail", out["rule_error"])
		self.assertNotIn("<", out["rule_error"])

	def test_a_fine_rate_has_no_warning(self):
		i = _inputs()
		out = negotiation.preview(PROP, RT, i["check_in_date"], i["check_out_date"], rates=[2400, 2400, 2400])
		self.assertNotIn("rule_error", out)


class TestOnAReservation(_Site):
	def book(self):
		from kamra.api import create_booking

		i = _inputs()
		return create_booking(
			property=PROP, room_type=RT, check_in_date=i["check_in_date"],
			check_out_date=i["check_out_date"], guest_name="Negotiation Test", phone="9000012345",
		)["reservation"]

	def test_agreed_rate_is_held_and_billed(self):
		name = self.book()
		res = frappe.get_doc("Reservation", name)
		system_total = res.amount_after_tax
		outcome = negotiation.apply_rates(res, [2000, 2000, 2000], "Walk-in bargained", "MD Sir")
		res.save()
		res.reload()
		self.assertEqual(res.auto_price, 0)
		self.assertEqual(res.rate_negotiated, 1)
		self.assertLess(res.amount_after_tax, system_total)
		self.assertAlmostEqual(res.amount_before_tax, 6000, places=1)
		self.assertEqual([round(r.rate, 2) for r in res.night_rates], [2000, 2000, 2000])
		self.assertEqual(res.negotiated_by, frappe.session.user)
		self.assertEqual(res.negotiated_reason, "Walk-in bargained")
		self.assertGreater(outcome["discount_pct"], 0)

	def test_the_folio_bills_the_agreed_rate(self):
		from kamra.folio import _nightly_room_rate

		res = frappe.get_doc("Reservation", self.book())
		negotiation.apply_rates(res, [2000, 2250, 2100], "bargain", "MD Sir")
		res.save()
		res.reload()
		billed = [_nightly_room_rate(res, add_days(res.check_in_date, i)) for i in range(3)]
		self.assertEqual([round(b, 2) for b in billed], [2000, 2250, 2100])

	def test_a_later_save_keeps_the_agreed_price(self):
		name = self.book()
		res = frappe.get_doc("Reservation", name)
		negotiation.apply_rates(res, [2100, 2100, 2100], "bargain", "GM Sir")
		res.save()
		again = frappe.get_doc("Reservation", name)
		again.internal_remarks = "touch"
		again.save()
		again.reload()
		self.assertAlmostEqual(again.amount_before_tax, 6300, places=1)
		self.assertEqual([round(r.rate, 2) for r in again.night_rates], [2100, 2100, 2100])

	def test_an_approver_is_required_for_a_discount(self):
		res = frappe.get_doc("Reservation", self.book())
		for approver in (None, "", "  ", "Nobody Sir"):
			with self.assertRaises(frappe.ValidationError):
				negotiation.apply_rates(res, [2000, 2000, 2000], "a note", approver)

	def test_the_note_is_optional_once_an_approver_is_named(self):
		res = frappe.get_doc("Reservation", self.book())
		negotiation.apply_rates(res, [2000, 2000, 2000], "", "GM Sir")
		self.assertEqual(res.rate_approved_by, "GM Sir")

	def test_a_disabled_name_cannot_be_chosen(self):
		frappe.db.set_value("Rate Approver", "GM Sir", "disabled", 1)
		res = frappe.get_doc("Reservation", self.book())
		with self.assertRaises(frappe.ValidationError):
			negotiation.apply_rates(res, [2000, 2000, 2000], "", "GM Sir")

	def test_endpoint_changes_the_rate_and_logs_it(self):
		name = self.book()
		before = frappe.db.count("Agent Action Log", {"action_type": "negotiate_rate", "reference_name": name})
		negotiation.set_negotiated_rate(name, [2200, 2200, 2200], "Repeat guest", "Front Office")
		self.assertEqual(frappe.db.get_value("Reservation", name, "auto_price"), 0)
		self.assertEqual(
			frappe.db.count("Agent Action Log", {"action_type": "negotiate_rate", "reference_name": name}),
			before + 1,
		)

	def test_internal_remarks_field_exists_and_saves(self):
		res = frappe.get_doc("Reservation", self.book())
		res.internal_remarks = "Advance Rs 5000 taken, receipt pending"
		res.save()
		res.reload()
		self.assertEqual(res.internal_remarks, "Advance Rs 5000 taken, receipt pending")

	def test_kamra_fields_we_depend_on_still_exist(self):
		meta = frappe.get_meta("Reservation")
		for f in ("auto_price", "night_rates", "rate_lock_key", "amount_before_tax", "tax_amount", "amount_after_tax"):
			self.assertTrue(meta.has_field(f), f)
		from kamra import api
		from kamra.kamra.doctype.reservation.reservation import Reservation

		for attr in ("set_night_rates", "quote_inputs", "rate_lock_key_for", "_apply_commission"):
			self.assertTrue(hasattr(Reservation, attr), attr)
		self.assertTrue(callable(api._assert_within_guardrails))
