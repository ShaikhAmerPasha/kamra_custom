"""Standard check-in 2:00 PM and check-out 12:00 PM for every property.

The registration card, the day's arrivals and the late check-out rule read these two times.
The hotel asked for 2 PM in and 12 PM out; a hotel can still change them in Property settings.
"""

import frappe


def execute():
	for name in frappe.get_all("Property", pluck="name"):
		frappe.db.set_value("Property", name, {"checkin_time": "14:00:00", "checkout_time": "12:00:00"})
