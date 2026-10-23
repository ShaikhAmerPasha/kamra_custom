"""Phase 1 of the patched screens: our build is served at /kamra, and the stock
page serves whenever it should."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import hooks, render


class TestPaths(IntegrationTestCase):
	def test_only_the_kamra_app_is_ours(self):
		for path in ("kamra", "/kamra", "kamra/tape", "/kamra/reservations/RES-1", "kamra/login"):
			self.assertTrue(render.is_kamra_path(path), path)
		for path in ("", "kamra-plus", "kamra-plus/book", "kamrax", "api/method/ping", "assets/kamra/x.js", "book"):
			self.assertFalse(render.is_kamra_path(path), path)

	def test_renderer_is_registered(self):
		self.assertIn("kamra_custom.render.KamraPatchedPage", hooks.page_renderer)


class TestSwitch(IntegrationTestCase):
	def tearDown(self):
		frappe.db.rollback()

	def page(self, path="kamra/tape"):
		frappe.local.request = frappe._dict(path="/" + path)
		return render.KamraPatchedPage(path=path)

	def test_on_by_default(self):
		self.assertTrue(render.enabled())

	def test_can_be_turned_off(self):
		frappe.db.set_single_value("Kamra Custom Settings", "use_patched_ui", 0)
		self.assertFalse(render.enabled())
		self.assertFalse(self.page().can_render())

	def test_turned_back_on(self):
		frappe.db.set_single_value("Kamra Custom Settings", "use_patched_ui", 0)
		frappe.db.set_single_value("Kamra Custom Settings", "use_patched_ui", 1)
		self.assertTrue(render.enabled())

	def test_renders_kamra_paths_when_built(self):
		if not frappe.os.path.exists(render.build_index()):
			self.skipTest("patched screens not built")
		self.assertTrue(self.page("kamra/tape").can_render())
		self.assertFalse(self.page("kamra-plus").can_render())
		self.assertFalse(self.page("api/method/ping").can_render())

	def test_serves_our_assets_and_the_session_token(self):
		if not frappe.os.path.exists(render.build_index()):
			self.skipTest("patched screens not built")
		resp = self.page("kamra").render()
		html = resp.get_data(as_text=True)
		self.assertIn("/assets/kamra_custom/kamra-ui/", html)
		self.assertNotIn("/assets/kamra/frontend/", html)
		self.assertIn("window.csrf_token", html)
		self.assertEqual(resp.headers.get("Cache-Control"), "no-store")
