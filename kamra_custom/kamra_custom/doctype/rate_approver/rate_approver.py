import frappe
from frappe import _
from frappe.model.document import Document


class RateApprover(Document):
	"""Who the front desk quotes as having agreed a lower rate: MD Sir, GM Sir, Front Office."""

	def validate(self):
		self.approver_name = " ".join((self.approver_name or "").split())
		if not 2 <= len(self.approver_name) <= 40:
			frappe.throw(_("The name must be 2 to 40 characters."))
