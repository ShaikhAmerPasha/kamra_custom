"""The screen switches (kamra_custom.flags)."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import flags


class TestFlags(IntegrationTestCase):
	def test_payment_links_are_off_until_a_gateway_is_integrated(self):
		self.assertIs(flags.DEFAULTS["payment_links"], False)

	def test_every_switch_is_a_field_of_the_settings(self):
		meta = frappe.get_meta("Kamra Custom Settings")
		for name in flags.FLAGS:
			self.assertTrue(meta.has_field(name), name)

	def test_the_switches_come_back_as_booleans(self):
		out = flags.ui_flags()
		self.assertEqual(set(out), set(flags.FLAGS))
		self.assertTrue(all(isinstance(v, bool) for v in out.values()))
