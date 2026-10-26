"""Which of our screen changes are switched on. Read by the customised screens."""

import frappe

# each switch and what it is until someone saves the settings
DEFAULTS = {
	"grc_staff_name": True,
	"checkout_date_on_booking": True,
	"merge_meal_in_room_line": False,
	"express_checkin": False,
	"clean_rooms_only": False,
}
FLAGS = tuple(DEFAULTS)


@frappe.whitelist()
def ui_flags() -> dict:
	"""Every feature switch as true or false. A switch never saved keeps its default."""
	out = {}
	for name, default in DEFAULTS.items():
		# a switch added after the settings were last saved has no stored value yet
		row = frappe.db.sql(
			"select value from `tabSingles` where doctype = %s and field = %s", ("Kamra Custom Settings", name)
		)
		value = row[0][0] if row else None
		out[name] = default if value in (None, "") else bool(int(value))
	return out
