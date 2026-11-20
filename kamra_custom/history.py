"""The activity ledger with filters a manager can use.

Kamra's `activity_feed` filters only by who acted. This wrapper keeps that call as it is and
adds a date range, a text search, and a record filter, so staff can ask "what happened to this
booking" or "what did we do on Tuesday". A reservation's own folios are included when its
history is asked for, so a payment appears next to the check-in it belongs to.
"""

import frappe
from frappe.utils import cint

from kamra.authz import require_roles

ROLES = ("Front Desk", "Finance", "Revenue Manager", "Kamra Agent")
MAX_PAGE = 200


def _like(text: str) -> str:
	"""A LIKE pattern that matches the text literally, wherever it sits."""
	return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _record_names(record: str) -> list[str]:
	"""The record itself, and for a reservation its folios."""
	names = [record]
	if record.startswith("RES-"):
		names += frappe.get_all("Folio", filters={"reservation": record}, pluck="name")
	return names


@frappe.whitelist()
@require_roles(*ROLES)
def activity_feed(property: str | None = None, actor_kind: str | None = None, action_type: str | None = None,
                  limit: int = 50, start: int = 0, search: str | None = None, date_from: str | None = None,
                  date_to: str | None = None, record: str | None = None):
	search, record = (search or "").strip(), (record or "").strip()
	if not (search or date_from or date_to or record):
		from kamra.agents_api import activity_feed as kamra_feed

		return kamra_feed(property=property, actor_kind=actor_kind, action_type=action_type, limit=limit, start=start)

	from kamra.authz import restricted_properties

	conds, params = [], {"limit": min(cint(limit) or 50, MAX_PAGE), "start": max(cint(start), 0)}
	allowed = restricted_properties()
	if property:
		conds.append("property = %(property)s")
		params["property"] = property
	elif allowed is not None:
		conds.append("property IN %(allowed)s")
		params["allowed"] = tuple(sorted(allowed)) or ("",)
	if actor_kind == "agent":
		conds.append("COALESCE(agent_name, '') != ''")
	elif actor_kind == "human":
		conds.append("COALESCE(agent_name, '') = ''")
	if action_type:
		conds.append("action_type = %(action_type)s")
		params["action_type"] = action_type
	if date_from:
		conds.append("creation >= %(date_from)s")
		params["date_from"] = f"{date_from} 00:00:00"
	if date_to:
		conds.append("creation <= %(date_to)s")
		params["date_to"] = f"{date_to} 23:59:59"
	if record:
		conds.append("(reference_name IN %(names)s OR rationale LIKE %(rec_like)s)")
		params["names"] = tuple(_record_names(record))
		params["rec_like"] = _like(record)
	if search:
		conds.append("(rationale LIKE %(like)s OR action_type LIKE %(like)s OR reference_name LIKE %(like)s OR actor LIKE %(like)s)")
		params["like"] = _like(search)
	where = "WHERE " + " AND ".join(conds) if conds else ""
	return frappe.db.sql(  # nosemgrep: frappe-sql-format-injection -- conditions are constants; values are parameters
		f"""SELECT name, creation, actor, agent_name, action_type, action_channel, approval_status,
		           autonomy, approver, reference_doctype, reference_name, rationale, minutes_saved, executed_at
		    FROM `tabAgent Action Log` {where}
		    ORDER BY creation DESC LIMIT %(limit)s OFFSET %(start)s""",
		params, as_dict=True)
