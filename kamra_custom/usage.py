"""Counts of which front desk shortcuts, buttons and screens are used, per day.

Only the action and how often. No guest, reservation, amount or user is stored. The
Desk Usage list (sorted by Times) shows what the desk really does most."""

import json

import frappe
from frappe.utils import cint, today

MAX_ACTIONS = 60  # per call
MAX_TIMES = 500  # per action per call


@frappe.whitelist()
def log_usage(counts: str | dict) -> int:
	"""Add `counts` ({action: times}) to today's totals. Returns how many actions were stored."""
	if frappe.session.user == "Guest":
		frappe.throw("Sign in first.", frappe.PermissionError)
	if isinstance(counts, str):
		counts = json.loads(counts or "{}")
	if not isinstance(counts, dict):
		return 0
	day, stored = today(), 0
	for action, times in list(counts.items())[:MAX_ACTIONS]:
		action = " ".join(str(action).split())[:140]
		times = min(max(cint(times), 0), MAX_TIMES)
		if not action or not times:
			continue
		name = frappe.db.get_value("Desk Usage", {"usage_date": day, "action": action})
		if name:
			frappe.db.sql("update `tabDesk Usage` set count = count + %s where name = %s", (times, name))
		else:
			frappe.get_doc({"doctype": "Desk Usage", "usage_date": day, "action": action, "count": times}).insert(
				ignore_permissions=True
			)
		stored += 1
	return stored
