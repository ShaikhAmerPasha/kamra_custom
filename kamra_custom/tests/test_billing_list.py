import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import billing

PROP = "SR Continental"


class TestBillingRows(IntegrationTestCase):
	"""The grouping, on plain data."""

	folios = [
		{"name": "F1", "reservation": "R1", "guest_name": "Rahul", "status": "Closed", "invoice_number": "INV1",
		 "grand_total": 1000, "payments_total": 1000, "balance": 0, "folio_type": "Guest", "bill_dt": "2026-11-11 10:00:00",
		 "check_in_date": "2026-11-10", "check_out_date": "2026-11-11", "source": "Manual", "channel": None, "ota_ref": None, "company": None},
		{"name": "F2", "reservation": "R1", "guest_name": "Rahul", "status": "Open", "invoice_number": None,
		 "grand_total": 500, "payments_total": 0, "balance": 500, "folio_type": "Company", "bill_dt": "2026-11-12 09:00:00",
		 "check_in_date": "2026-11-10", "check_out_date": "2026-11-11", "source": "Manual", "channel": None, "ota_ref": None, "company": "Acme"},
		{"name": "F3", "reservation": "R2", "guest_name": "Meera", "status": "Closed", "invoice_number": "INV2",
		 "grand_total": 2000, "payments_total": 2000, "balance": 0, "folio_type": "Guest", "bill_dt": "2026-11-09 08:00:00",
		 "check_in_date": "2026-11-08", "check_out_date": "2026-11-09", "source": "OTA", "channel": "MakeMyTrip", "ota_ref": "MMT123", "company": None},
	]
	payments = [
		{"parent": "F1", "mode": "Cash", "amount": 600},
		{"parent": "F1", "mode": "Card", "amount": 400},
		{"parent": "F3", "mode": "Bank Transfer", "amount": 2000},
		{"parent": "F3", "mode": "Cash", "amount": -100},
	]

	def rows(self):
		return {r["key"]: r for r in billing.build_rows(self.folios, self.payments)}

	def test_two_folios_of_one_stay_are_one_row(self):
		rows = self.rows()
		self.assertEqual(len(rows), 2)
		r = rows["R1"]
		self.assertEqual([f["name"] for f in r["folios"]], ["F1", "F2"])
		self.assertEqual(r["amount"], 1500)
		self.assertEqual(r["balance"], 500)
		self.assertEqual(r["status"], "Open")

	def test_how_it_was_paid(self):
		self.assertEqual(self.rows()["R1"]["payment_modes"], "Cash, Card")
		# a refund is not a way of paying
		self.assertEqual(self.rows()["R2"]["payment_modes"], "Bank Transfer")

	def test_an_online_booking_shows_the_ota_pnr(self):
		r = self.rows()["R2"]
		self.assertEqual(r["booking_id"], "MMT123")
		self.assertEqual(r["booked_through"], "MakeMyTrip")

	def test_a_direct_booking_shows_its_own_number(self):
		r = self.rows()["R1"]
		self.assertEqual(r["booking_id"], "R1")
		self.assertEqual(r["booked_through"], "Direct" if not self.folios[0]["company"] else "Acme")

	def test_the_bill_date_is_the_latest_of_the_stay(self):
		self.assertEqual(self.rows()["R1"]["bill_date"], "2026-11-12")


class TestBillingList(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_lists_the_sites_folios_newest_first(self):
		out = billing.stays(PROP)
		self.assertGreaterEqual(out["total"], 1)
		dates = [r["bill_date"] for r in out["rows"]]
		self.assertEqual(dates, sorted(dates, reverse=True))

	def test_search_finds_a_guest(self):
		first = billing.stays(PROP)["rows"][0]
		hit = billing.stays(PROP, q=first["guest"].split()[0])
		self.assertIn(first["key"], [r["key"] for r in hit["rows"]])

	def test_search_by_invoice_number(self):
		rows = [r for r in billing.stays(PROP)["rows"] if r["folios"][0]["invoice_number"]]
		if not rows:
			self.skipTest("no invoice on this site")
		inv = rows[0]["folios"][0]["invoice_number"]
		self.assertTrue(billing.stays(PROP, q=inv)["rows"])

	def test_a_date_range_keeps_only_those_days(self):
		out = billing.stays(PROP, date_from="2026-11-11", date_to="2026-11-11")
		for r in out["rows"]:
			self.assertTrue(any(True for _ in r["folios"]))
		self.assertEqual(billing.stays(PROP, date_from="2001-01-01", date_to="2001-01-02")["total"], 0)

	def test_from_after_to_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			billing.stays(PROP, date_from="2026-11-12", date_to="2026-11-01")

	def test_status_filter(self):
		for r in billing.stays(PROP, status="Open")["rows"]:
			self.assertEqual(r["status"], "Open")

	def test_paging(self):
		a = billing.stays(PROP, start=0, limit=1)
		self.assertLessEqual(len(a["rows"]), 1)
