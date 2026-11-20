"""The activity ledger filters (kamra_custom.history)."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import history

PROP = "SR Continental"


def log(rationale, reference_name="RES-TEST-1", **kw):
	doc = frappe.get_doc({"doctype": "Agent Action Log", "property": PROP, "actor": "Administrator",
	                      "action_type": kw.get("action_type", "Check In"), "action_channel": "Desk",
	                      "approval_status": "Executed", "autonomy": "Full", "rationale": rationale,
	                      "reference_doctype": "Reservation", "reference_name": reference_name})
	doc.flags.ignore_links = True
	doc.insert(ignore_permissions=True)
	if kw.get("creation"):
		frappe.db.set_value("Agent Action Log", doc.name, "creation", kw["creation"], update_modified=False)
	return doc.name


class TestHistory(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

	def names(self, **kw):
		return [r["name"] for r in history.activity_feed(property=PROP, limit=200, **kw)]

	def test_record_filter_finds_that_record_only(self):
		a = log("alpha stay", "RES-TEST-1")
		b = log("beta stay", "RES-TEST-2")
		got = self.names(record="RES-TEST-1")
		self.assertIn(a, got)
		self.assertNotIn(b, got)

	def test_record_filter_matches_a_record_named_in_the_text(self):
		a = log("Reservation RES-TEST-9 moved to Checked In", "FOLIO-X")
		self.assertIn(a, self.names(record="RES-TEST-9"))

	def test_text_search_is_literal(self):
		a = log("paid 100% in cash")
		b = log("paid 100 in cash")
		got = self.names(search="100%")
		self.assertIn(a, got)
		self.assertNotIn(b, got)

	def test_date_range(self):
		old = log("old entry", creation="2020-01-05 10:00:00")
		new = log("new entry")
		got = self.names(date_from="2020-01-05", date_to="2020-01-05")
		self.assertIn(old, got)
		self.assertNotIn(new, got)

	def test_without_filters_it_is_kamras_own_feed(self):
		from kamra.agents_api import activity_feed as kamras

		log("plain")
		ours = history.activity_feed(property=PROP, limit=5)
		self.assertEqual([r["name"] for r in ours], [r["name"] for r in kamras(property=PROP, limit=5)])

	def test_the_function_is_the_one_registered(self):
		self.assertEqual(frappe.override_whitelisted_method("kamra.agents_api.activity_feed"),
		                 "kamra_custom.history.activity_feed")
