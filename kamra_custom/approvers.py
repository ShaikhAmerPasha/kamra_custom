"""Who approved a lower rate (or, later, a complimentary stay).

A short list the hotel keeps: MD Sir, GM Sir, Front Office. Any desk user picks from it;
only a manager adds a name, from the booking screen or from the Rate Approver list.
"""

import frappe
from frappe import _

from kamra.authz import require_roles

MANAGERS = ("System Manager", "Hotel Admin", "Revenue Manager")
DESK = ("Front Desk", "Revenue Manager", "Kamra Agent", "Hotel Admin")


def can_create() -> bool:
	return frappe.session.user == "Administrator" or bool(set(frappe.get_roles()) & set(MANAGERS))


@frappe.whitelist()
@require_roles(*DESK)
def list_approvers() -> dict:
	rows = frappe.get_all(
		"Rate Approver", filters={"disabled": 0}, fields=["name", "can_approve_complimentary"], order_by="creation asc"
	)
	return {
		"approvers": [r.name for r in rows],
		"complimentary": [r.name for r in rows if r.can_approve_complimentary],
		"can_create": can_create(),
	}


@frappe.whitelist(methods=["POST"])
@require_roles(*DESK)
def create_approver(name: str) -> dict:
	if not can_create():
		frappe.throw(_("Only a manager can add a name to this list."), frappe.PermissionError)
	clean = " ".join((name or "").split())
	if frappe.db.exists("Rate Approver", clean):
		frappe.db.set_value("Rate Approver", clean, "disabled", 0)
		return {"name": clean}
	doc = frappe.get_doc({"doctype": "Rate Approver", "approver_name": clean}).insert()
	return {"name": doc.name}


def check_complimentary_approver(name: str | None) -> str:
	"""A name that may approve a complimentary stay, or a clear refusal."""
	clean = check_approver(name)
	if not frappe.db.get_value("Rate Approver", clean, "can_approve_complimentary"):
		frappe.throw(_("{0} cannot approve a complimentary stay. Choose MD Sir or GM Sir.").format(clean), title=_("Approver needed"))
	return clean


def check_approver(name: str | None) -> str:
	"""The chosen name, or a clear refusal. Used wherever a discount is given."""
	clean = " ".join((name or "").split())
	if not clean:
		frappe.throw(_("Choose who approved this rate: MD Sir, GM Sir or Front Office."), title=_("Approver needed"))
	row = frappe.db.get_value("Rate Approver", clean, ["name", "disabled"], as_dict=True)
	if not row or row.disabled:
		frappe.throw(_("{0} is not on the approver list.").format(clean), title=_("Approver needed"))
	return row.name
