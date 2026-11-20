"""The manager's house screen in one call (kamra_custom.house)."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import house

PROP = "SR Continental"


class TestHouse(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_it_carries_every_block_the_screen_draws(self):
		out = house.house_today(PROP)
		for key in ("business_date", "calendar_date", "days_behind", "periods", "movement", "rooms", "attention", "collected", "owed"):
			self.assertIn(key, out)
		self.assertEqual(set(out["periods"]), {"today", "mtd", "ytd"})

	def test_periods_have_this_year_and_last_year_figures(self):
		p = house.house_today(PROP)["periods"]["mtd"]
		for key in house.PERIOD_KEYS:
			self.assertIn(key, p["this"])
			self.assertIn(key, p["last"])
		self.assertLessEqual(p["from"], p["to"])

	def test_the_figures_are_kamras_own(self):
		from kamra.business_date import get_business_date
		from kamra.dashboards import comparison

		date = str(get_business_date(PROP))
		rooms = frappe.db.count("Room", {"property": PROP})
		kamras = {p["id"]: p for p in comparison(PROP, date, rooms, [])["periods"]}
		ours = house.house_today(PROP)["periods"]
		self.assertEqual(ours["today"]["this"]["total_revenue"], float(kamras["today"]["this_year"]["total_revenue"]))
		self.assertEqual(ours["ytd"]["this"]["room_revenue"], float(kamras["ytd"]["this_year"]["room_revenue"]))

	def test_the_room_counts_cover_every_room(self):
		r = house.house_today(PROP)["rooms"]
		self.assertEqual(r["total"], frappe.db.count("Room", {"property": PROP}))
		self.assertLessEqual(r["clean"] + r["dirty"] + r["inspected"] + r["out_of_order"], r["total"])

	def test_guests_in_house_match_the_in_house_reservations(self):
		g = house.house_today(PROP)["guests"]
		rows = frappe.get_all("Reservation", filters={"property": PROP, "status": "Checked In"}, fields=["adults", "children"])
		self.assertEqual(g["adults"], sum(int(r.adults or 0) for r in rows))
		self.assertEqual(g["children"], sum(int(r.children or 0) for r in rows))
		self.assertGreaterEqual(g["complimentary"], 0)

	def test_days_behind_matches_the_dates(self):
		from frappe.utils import date_diff

		out = house.house_today(PROP)
		self.assertEqual(out["days_behind"], max(0, date_diff(out["calendar_date"], out["business_date"])))

	def test_attention_counts_match_the_attention_panel(self):
		from kamra_custom import attention

		a = attention.attention(PROP)
		self.assertEqual(house.house_today(PROP)["attention"]["total"], a["total"])

	def test_owed_is_never_negative_for_companies(self):
		self.assertGreaterEqual(house.house_today(PROP)["owed"]["companies"], 0)

	def test_unknown_property_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			house.house_today("NO SUCH PROPERTY")
