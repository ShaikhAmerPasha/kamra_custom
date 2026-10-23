"""Phase 2: the bill screen reads Kamra's `folio_invoice`. If Kamra changes the
shape we depend on, these tests fail before the screen shows a blank bill."""

import unittest

import frappe


class TestFolioInvoiceContract(unittest.TestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.folio = frappe.db.get_value("Folio", {"property": "SR Continental"}, "name") or frappe.db.get_value("Folio", {}, "name")
		if not self.folio:
			self.skipTest("no folio on this site to read")

	def test_fields_the_bill_screen_reads(self):
		from kamra.api import folio_invoice

		inv = folio_invoice(self.folio)
		for key in ("folio", "lines", "document", "property", "stay", "summary_by_head", "tax_summary"):
			self.assertIn(key, inv)
		for key in ("title", "is_final", "number", "date"):
			self.assertIn(key, inv["document"])
		for key in ("charges", "payments", "charges_total", "tax_total", "grand_total", "payments_total", "balance"):
			self.assertIn(key, inv["folio"])

	def test_each_tax_slab_lists_its_parts(self):
		from kamra.api import folio_invoice

		for slab in folio_invoice(self.folio)["tax_summary"]:
			self.assertTrue(slab["parts"])
			for part in slab["parts"]:
				self.assertTrue({"label", "rate", "amount"} <= set(part))
			# the parts together are the slab's tax
			self.assertAlmostEqual(sum(p["amount"] for p in slab["parts"]), slab["total_tax"], places=2)

	def test_india_splits_into_cgst_and_sgst(self):
		from kamra.api import folio_invoice

		for name in frappe.get_all("Folio", filters={"property": "SR Continental"}, pluck="name"):
			slabs = folio_invoice(name)["tax_summary"]
			if slabs:
				self.assertEqual([p["label"] for p in slabs[0]["parts"]], ["CGST", "SGST"])
				return
		self.skipTest("no folio with tax on this property")
