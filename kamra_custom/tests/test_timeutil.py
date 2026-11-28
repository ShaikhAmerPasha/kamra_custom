from datetime import time, timedelta

from frappe.tests import IntegrationTestCase

from kamra_custom.timeutil import hhmm


class TestHhmm(IntegrationTestCase):
	def test_every_shape_the_database_gives(self):
		for v in ("08:00:00", "8:00:00", "08:00", "8:00", time(8, 0), time(8, 0, 30), timedelta(hours=8), timedelta(hours=8, seconds=59)):
			self.assertEqual(hhmm(v), "08:00", repr(v))
		self.assertEqual(hhmm(timedelta(hours=14, minutes=5)), "14:05")

	def test_no_time_is_empty(self):
		for v in (None, "", timedelta(0), 0):
			self.assertEqual(hhmm(v), "")

	def test_nonsense_is_empty_not_an_error(self):
		for v in ("abc", ":30", "x:10"):
			self.assertEqual(hhmm(v), "")

	def test_it_compares_correctly_as_text(self):
		self.assertLess(hhmm("8:00:00"), "09:30")
