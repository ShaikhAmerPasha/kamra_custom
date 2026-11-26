"""Folio routing of a stay: which charges belong on which of its folios.

Kamra routes a charge when it is posted: the company's billing rules, the group's main room, and
`pays_own_charges`. MyCloud also lets the desk say, for one booking, that a kind of charge (room,
meal, food) goes to folio #2 or to the company, for some dates. Replacing Kamra's own routing would
change how night audit and POS post, so this works the other way round: the rules are saved on the
booking, and "apply" moves the charges already posted with Kamra's own transfer call (the same one
the folio screen uses, with its ledger entries and its refusal to bill liquor to a company).
"""

import json

import frappe
from frappe import _
from frappe.utils import getdate

from kamra.authz import require_roles

TARGETS = ("Guest", "Extra", "Company", "Group")
SKIP_TYPES = ("Opening Balance", "Allowance")
CLOSED = ("Checked Out", "Cancelled", "No Show")
MAX_RULES = 30


def charge_types() -> list[str]:
	opts = frappe.get_meta("Folio Charge").get_field("charge_type").options or ""
	return [o for o in opts.split("\n") if o and o not in SKIP_TYPES]


def clean(routes, res=None) -> list[dict]:
	"""The rules checked and tidied, or a message the desk can read."""
	rows = frappe.parse_json(routes) if isinstance(routes, str) else (routes or [])
	if len(rows) > MAX_RULES:
		frappe.throw(_("At most {0} rules.").format(MAX_RULES))
	allowed = charge_types()
	out, seen = [], set()
	for r in rows:
		ct, target = (r.get("charge_type") or "").strip(), (r.get("target") or "").strip()
		if ct not in allowed:
			frappe.throw(_("Choose the kind of charge from the list."))
		if target not in TARGETS:
			frappe.throw(_("Choose where the charge goes from the list."))
		df, dt = (r.get("date_from") or "").strip() or None, (r.get("date_to") or "").strip() or None
		try:
			a, b = (getdate(df) if df else None), (getdate(dt) if dt else None)
		except Exception:
			frappe.throw(_("A date in the routing rules is not a date."))
		if a and b and a > b:
			frappe.throw(_("A rule's first date is after its last date."))
		if (ct, df, dt) in seen:
			frappe.throw(_("{0} has two rules for the same dates.").format(_(ct)))
		seen.add((ct, df, dt))
		if res is not None:
			if target == "Company" and not res.get("company"):
				frappe.throw(_("Set the company that pays on the booking first, to route charges to it."))
			if target == "Group" and not res.get("group_booking"):
				frappe.throw(_("Only a room of a group booking can route charges to the group bill."))
		out.append({"charge_type": ct, "target": target, "date_from": df, "date_to": dt})
	return out


def rules_of(res) -> list[dict]:
	try:
		rows = json.loads(res.get("folio_routes") or "[]")
	except ValueError:
		return []
	return rows if isinstance(rows, list) else []


def _matches(rule: dict, row) -> bool:
	if row.charge_type != rule["charge_type"]:
		return False
	day = row.get("stay_date") or row.get("posting_date")
	if not (rule.get("date_from") or rule.get("date_to")):
		return True
	if not day:
		return False
	day = getdate(day)
	return (not rule.get("date_from") or day >= getdate(rule["date_from"])) and (not rule.get("date_to") or day <= getdate(rule["date_to"]))


def pending(res) -> list[dict]:
	"""Charges that sit on another folio than their rule says. The first rule that fits a charge decides."""
	from kamra.folio import voided_rows

	rules = rules_of(res)
	if not rules:
		return []
	out = []
	for name in frappe.get_all("Folio", filters={"reservation": res.name, "status": "Open"}, pluck="name"):
		folio = frappe.get_doc("Folio", name)
		voided = voided_rows(folio)
		for row in folio.charges:
			if row.get("reversal_of") or voided.get(row.name):
				continue
			rule = next((r for r in rules if _matches(r, row)), None)
			if not rule or folio.folio_type == rule["target"]:
				continue
			if row.get("is_alcohol") and rule["target"] in ("Company", "Group"):
				continue  # liquor never goes to a company
			out.append({"folio": folio.name, "row": row.name, "charge_type": row.charge_type, "description": row.description,
			            "stay_date": str(row.get("stay_date") or ""), "amount": float(row.total or row.amount or 0),
			            "from_type": folio.folio_type, "target": rule["target"]})
	return out


def _get(res) -> dict:
	return {"reservation": res.name, "status": res.status, "editable": res.status not in CLOSED,
	        "has_company": bool(res.get("company")), "in_group": bool(res.get("group_booking")),
	        "charge_types": charge_types(), "targets": list(TARGETS), "routes": rules_of(res), "pending": pending(res)}


@frappe.whitelist()
@require_roles("Front Desk", "Finance", "Revenue Manager", "Night Auditor", "Kamra Agent")
def get(reservation: str) -> dict:
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	return _get(res)


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Finance", "Kamra Agent")
def save(reservation: str, routes) -> dict:
	"""Keep the routing rules of a stay that is still open. Nothing moves until they are applied."""
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	frappe.has_permission("Reservation", "write", doc=res, throw=True)
	if res.status in CLOSED:
		frappe.throw(_("A {0} booking cannot be changed.").format(res.status))
	rules = clean(routes, res)
	res.folio_routes = json.dumps(rules) if rules else ""
	res.save()
	return _get(res)


def _target_folio(res, target: str) -> tuple[str | None, int]:
	"""The folio a rule points at (opened if needed), or (None, 1) for the company folio, which Kamra's call opens."""
	from kamra.folio import open_folio, open_group_folio, split_folio

	if target == "Guest":
		return open_folio(res), 0
	if target == "Extra":
		return split_folio(res.name, "Extra"), 0
	if target == "Group":
		return open_group_folio(res.group_booking), 0
	return None, 1


@frappe.whitelist(methods=["POST"])
@require_roles("Front Desk", "Finance", "Kamra Agent")
def apply(reservation: str) -> dict:
	"""Move the charges that are on the wrong folio, with Kamra's transfer. Returns {results, done, failed}."""
	from kamra.api import transfer_folio_charges
	from kamra.crs import assert_property_access

	res = frappe.get_doc("Reservation", reservation)
	assert_property_access(res.property)
	if res.status in CLOSED:
		frappe.throw(_("A {0} booking cannot be changed.").format(res.status))
	groups: dict[tuple, list] = {}
	for p in pending(res):
		groups.setdefault((p["folio"], p["target"]), []).append(p)
	results = []
	for (src, target), items in groups.items():
		frappe.db.savepoint("route_move")
		try:
			to_folio, to_company = _target_folio(res, target)
			transfer_folio_charges(from_folio=src, charge_rows=[i["row"] for i in items], to_folio=to_folio,
			                       to_company=to_company, reason="Folio routing rule")
			results += [{"charge": i["description"] or i["charge_type"], "stay_date": i["stay_date"], "to": target, "ok": True, "message": _("Moved")} for i in items]
		except Exception as e:
			frappe.db.rollback(save_point="route_move")
			msg = frappe.utils.strip_html(str(e)) or _("This did not work.")
			results += [{"charge": i["description"] or i["charge_type"], "stay_date": i["stay_date"], "to": target, "ok": False, "message": msg} for i in items]
		finally:
			frappe.local.message_log = []
	done = sum(1 for r in results if r["ok"])
	return {"results": results, "done": done, "failed": len(results) - done, "pending": len(pending(frappe.get_doc("Reservation", reservation)))}
