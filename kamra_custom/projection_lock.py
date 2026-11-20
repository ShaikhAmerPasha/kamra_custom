"""One check-out projection at a time.

For a guest who is due out, Kamra's `_stay_balances` works out what check-out would charge by
posting the remaining nights inside a savepoint and rolling it back (`_checkout_projection`).
A screen loads several calls at once (the desk list, Needs attention, the stay, the check-out
panel) and each runs that projection. Two of them writing the same folio rows deadlock, MariaDB
cancels one whole request, and the desk sees "Something went wrong on the server".

This wraps Kamra's function so projections take turns, using a database lock that works across
all server processes. If the lock is not free within a few seconds the caller gets Kamra's own
fallback (the figures posted so far), which is what Kamra returns when a projection fails.
Nothing of Kamra's code is copied.
"""

import functools

import frappe

WAIT_SECONDS = 4


def _lock_name() -> str:
	return f"kamra_projection:{frappe.local.site}"[:64]


def wrap(original):
	@functools.wraps(original)
	def locked(names):
		name = _lock_name()
		got = frappe.db.sql("SELECT GET_LOCK(%s, %s)", (name, WAIT_SECONDS))[0][0]
		if got != 1:
			return {}
		try:
			return original(names)
		finally:
			frappe.db.sql("SELECT RELEASE_LOCK(%s)", (name,))

	locked._kamra_custom_locked = True
	return locked


def install(*args, **kwargs):
	"""before_request hook: wrap Kamra's projection once per process."""
	import kamra.api as kamra_api

	fn = getattr(kamra_api, "_checkout_projection", None)
	if fn is None or getattr(fn, "_kamra_custom_locked", False):
		return
	kamra_api._checkout_projection = wrap(fn)
