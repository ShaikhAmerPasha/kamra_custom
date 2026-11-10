from frappe.model.document import Document


class DeskUsage(Document):
	"""How often each shortcut, button and screen is used on a day. Counts only: no guest, no user."""
