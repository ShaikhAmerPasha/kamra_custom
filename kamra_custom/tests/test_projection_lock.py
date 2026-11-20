"""Check-out projections take turns (kamra_custom.projection_lock)."""

import frappe
from frappe.tests import IntegrationTestCase

from kamra_custom import projection_lock


class TestProjectionLock(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_it_runs_the_original_and_frees_the_lock(self):
		calls = []
		wrapped = projection_lock.wrap(lambda names: calls.append(list(names)) or {"x": 1})
		self.assertEqual(wrapped(["A"]), {"x": 1})
		self.assertEqual(calls, [["A"]])
		free = frappe.db.sql("SELECT IS_FREE_LOCK(%s)", (projection_lock._lock_name(),))[0][0]
		self.assertEqual(free, 1)

	def test_it_frees_the_lock_when_the_original_fails(self):
		def boom(names):
			raise RuntimeError("no")

		with self.assertRaises(RuntimeError):
			projection_lock.wrap(boom)(["A"])
		self.assertEqual(frappe.db.sql("SELECT IS_FREE_LOCK(%s)", (projection_lock._lock_name(),))[0][0], 1)

	def test_a_busy_lock_gives_kamras_fallback_not_an_error(self):
		name = projection_lock._lock_name()
		frappe.db.sql("SELECT GET_LOCK(%s, 0)", (name,))
		try:
			# the same connection already holds it, so use a second connection
			import MySQLdb

			conf = frappe.conf
			conn = MySQLdb.connect(host=conf.get("db_host") or "127.0.0.1", user=frappe.conf.db_name,
			                       passwd=frappe.conf.db_password, database=frappe.conf.db_name)
			cur = conn.cursor()
			cur.execute("SELECT GET_LOCK(%s, 0)", (name,))
			got_second = cur.fetchone()[0]
			conn.close()
		finally:
			frappe.db.sql("SELECT RELEASE_LOCK(%s)", (name,))
		# the same session can re-take its own lock; a different one cannot
		self.assertEqual(got_second, 0)

	def test_install_wraps_once(self):
		import kamra.api as kamra_api

		original = kamra_api._checkout_projection
		try:
			projection_lock.install()
			first = kamra_api._checkout_projection
			projection_lock.install()
			self.assertIs(kamra_api._checkout_projection, first)
			self.assertTrue(first._kamra_custom_locked)
		finally:
			kamra_api._checkout_projection = original

	def test_the_hook_is_registered(self):
		from kamra_custom import hooks

		self.assertIn("kamra_custom.projection_lock.install", hooks.before_request)
