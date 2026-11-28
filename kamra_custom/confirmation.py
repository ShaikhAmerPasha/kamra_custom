"""A booking's confirmation, and the guest's phone and email.

The reservation screen has a Basic details block with the guest's phone and email,
and a Send button. The send choices are:

* download: a PDF made here;
* WhatsApp: the screen opens WhatsApp with `message()` ready to send;
* email: `send_email()` sends the same details, with the PDF, from the site's outgoing email.
"""

import re

import frappe
from frappe import _
from frappe.utils import escape_html, formatdate, validate_email_address

from kamra.authz import require_roles
from kamra.localization import money_text
from kamra_custom.guests import property_region
from kamra_custom.phone import to_key
from kamra_custom.timeutil import hhmm

ROLES = ("Front Desk", "Kamra Agent")

# the documents the desk can send, and the ways to send them
KINDS = {"confirmation": "Booking confirmation", "amended": "Amended booking confirmation",
         "pre-arrival": "Pre-arrival message"}
CHANNELS = ("Download", "WhatsApp", "Email")
SENT = "Sent: "
HISTORY_SHOWN = 5


def _kind(kind: str | None) -> str:
	kind = (kind or "confirmation").strip()
	if kind not in KINDS:
		frappe.throw(_("{0} is not a document that can be sent from here.").format(kind))
	return kind


def _reservation(name: str):
	res = frappe.get_doc("Reservation", name)
	frappe.has_permission("Reservation", "read", doc=res, throw=True)
	from kamra.crs import assert_property_access

	assert_property_access(res.property)
	return res


_hhmm = hhmm


def _12h(value) -> str:
	text = _hhmm(value)
	if not text:
		return ""
	hour, minute = int(text[:2]), text[3:5]
	return f"{hour % 12 or 12}:{minute} {'AM' if hour < 12 else 'PM'}"


def facts(res) -> dict:
	"""What the guest needs to read, as plain values."""
	prop = frappe.get_cached_doc("Property", res.property)
	guest = frappe.db.get_value("Guest", res.guest, ["phone", "email"], as_dict=True) if res.guest else {}
	room_type = frappe.db.get_value("Room Type", res.room_type, "room_type_name") or res.room_type
	meal = frappe.db.get_value("Meal Plan", res.meal_plan, "label") if res.get("meal_plan") else None
	total = res.amount_after_tax or 0
	paid = res.get("advance_paid") or 0
	return {
		"booking": res.name,
		"hotel": prop.property_name,
		"hotel_phone": prop.get("phone") or "",
		"hotel_email": prop.get("email") or "",
		"hotel_address": ", ".join(x for x in (prop.get("address_line"), prop.get("city")) if x),
		"guest": res.guest_name,
		"phone": (guest or {}).get("phone") or "",
		"email": (guest or {}).get("email") or "",
		"room_type": room_type,
		"meal_plan": meal or "",
		"check_in": formatdate(res.check_in_date),
		"check_out": formatdate(res.check_out_date),
		"arrival_time": _12h(res.get("planned_check_in_time")),
		"departure_time": _12h(res.get("planned_check_out_time")),
		"nights": max(1, (frappe.utils.getdate(res.check_out_date) - frappe.utils.getdate(res.check_in_date)).days),
		"adults": res.get("adults") or 0,
		"children": res.get("children") or 0,
		"total": money_text(res.property, total),
		"advance": money_text(res.property, paid) if paid else "",
		"balance": money_text(res.property, max(0, total - paid)),
		"requests": (res.get("special_requests") or "").strip(),
	}


def message_text(f: dict, kind: str = "confirmation", link: str = "") -> str:
	"""The WhatsApp and email text for a confirmation, an amended confirmation or a pre-arrival message."""
	if kind == "pre-arrival":
		lines = [
			_("Your stay at {0}").format(f["hotel"]),
			"",
			_("Dear {0},").format(f["guest"]),
			_("We look forward to welcoming you on {0}{1}.").format(
				f["check_in"], f" (from {f['arrival_time']})" if f["arrival_time"] else ""),
			_("Booking {0}: {1}, {2} night(s).").format(f["booking"], f["room_type"], f["nights"]),
		]
		if link:
			lines += ["", _("Save time at the desk. Add your details and ID here:"), link]
		if f["hotel_address"]:
			lines += ["", f["hotel_address"]]
		if f["hotel_phone"]:
			lines.append(_("Call us: {0}").format(f["hotel_phone"]))
		return "\n".join(lines)
	amended = kind == "amended"
	lines = [
		(_("Booking updated - {0}") if amended else _("Booking confirmation - {0}")).format(f["hotel"]),
		"",
		_("Dear {0},").format(f["guest"]),
		(_("Your booking {0} has been updated. These are the new details.") if amended
		 else _("Your booking {0} is confirmed.")).format(f["booking"]),
		"",
		_("Check-in: {0}{1}").format(f["check_in"], f" ({f['arrival_time']})" if f["arrival_time"] else ""),
		_("Check-out: {0}{1}").format(f["check_out"], f" ({f['departure_time']})" if f["departure_time"] else ""),
		_("Room: {0}{1}, {2} night(s)").format(f["room_type"], f" - {f['meal_plan']}" if f["meal_plan"] else "", f["nights"]),
		_("Guests: {0} adult(s){1}").format(f["adults"], _(", {0} child(ren)").format(f["children"]) if f["children"] else ""),
		_("Total: {0}").format(f["total"]),
	]
	if f["advance"]:
		lines += [_("Advance paid: {0}").format(f["advance"]), _("Balance: {0}").format(f["balance"])]
	if f["hotel_address"]:
		lines += ["", f["hotel_address"]]
	if f["hotel_phone"]:
		lines.append(_("Call us: {0}").format(f["hotel_phone"]))
	return "\n".join(lines)


def confirmation_html(f: dict, kind: str = "confirmation") -> str:
	rows = [
		(_("Booking"), f["booking"]),
		(_("Guest"), f["guest"]),
		(_("Check-in"), f["check_in"] + (f" &middot; {f['arrival_time']}" if f["arrival_time"] else "")),
		(_("Check-out"), f["check_out"] + (f" &middot; {f['departure_time']}" if f["departure_time"] else "")),
		(_("Nights"), str(f["nights"])),
		(_("Room"), f["room_type"] + (f" &middot; {f['meal_plan']}" if f["meal_plan"] else "")),
		(_("Guests"), _("{0} adult(s)").format(f["adults"]) + (_(", {0} child(ren)").format(f["children"]) if f["children"] else "")),
		(_("Total"), f["total"]),
	]
	if f["advance"]:
		rows += [(_("Advance paid"), f["advance"]), (_("Balance"), f["balance"])]
	if f["requests"]:
		rows.append((_("Special requests"), escape_html(f["requests"]).replace("\n", "<br>")))
	body = "".join(
		f"<tr><th>{escape_html(k) if k != _('Special requests') else k}</th><td>{v if k in (_('Check-in'), _('Check-out'), _('Room'), _('Guests'), _('Special requests')) else escape_html(v)}</td></tr>"
		for k, v in rows
	)
	contact = " &middot; ".join(escape_html(x) for x in (f["hotel_address"], f["hotel_phone"], f["hotel_email"]) if x)
	return f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}}
h1{{font-size:20pt;margin:0 0 2px}} h2{{font-size:13pt;color:#0f5132;margin:0 0 18px;font-weight:600}}
table{{border-collapse:collapse;width:100%;font-size:11pt}} th,td{{border-bottom:1px solid #ddd;padding:7px 4px;text-align:left}}
th{{width:30%;color:#555;font-weight:600}} .foot{{margin-top:24px;font-size:9.5pt;color:#555}}
</style></head><body>
<h1>{escape_html(f['hotel'])}</h1><h2>{_('Booking amended') if kind == 'amended' else _('Booking confirmation')}</h2>
<p>{_('Dear {0},').format(escape_html(f['guest']))} {_('your booking has been updated. These are the new details.') if kind == 'amended' else _('your booking is confirmed.')}</p>
<table>{body}</table>
<p class="foot">{contact}</p></body></html>"""


def precheckin_link(res) -> str:
	"""The guest's online check-in link, made the first time it is wanted (the same link Kamra's own send uses)."""
	token = res.get("precheckin_token")
	if not token:
		token = frappe.generate_hash(length=32)
		frappe.db.set_value("Reservation", res.name, "precheckin_token", token)
	return f"{frappe.utils.get_url()}/kamra/checkin/{token}"


def _history(name: str) -> list[dict]:
	rows = frappe.get_all(
		"Comment",
		filters={"reference_doctype": "Reservation", "reference_name": name, "comment_type": "Info",
		         "content": ("like", f"{SENT}%")},
		fields=["creation", "owner", "content"], order_by="creation desc", limit=HISTORY_SHOWN)
	out = []
	for r in rows:
		# "Sent: <kind> | <channel> | <to>"
		parts = [x.strip() for x in r.content[len(SENT):].split("|")]
		out.append({"when": str(r.creation), "by": r.owner, "kind": parts[0],
		            "channel": parts[1] if len(parts) > 1 else "", "to": parts[2] if len(parts) > 2 else ""})
	return out


def _stale(res, history: list[dict]) -> bool:
	"""A confirmation went out and the booking changed after it, so the guest holds old details."""
	if res.status != "Confirmed":
		return False
	last = next((h for h in history if h["kind"] in ("confirmation", "amended")), None)
	return bool(last and frappe.utils.get_datetime(res.modified) > frappe.utils.get_datetime(last["when"]))


def _remember(res, kind: str, channel: str, to: str = "") -> None:
	frappe.get_doc({
		"doctype": "Comment", "comment_type": "Info", "reference_doctype": "Reservation",
		"reference_name": res.name, "content": f"{SENT}{kind} | {channel} | {to}".rstrip(" |"),
	}).insert(ignore_permissions=True)


@frappe.whitelist()
@require_roles(*ROLES)
def details(reservation: str, kind: str = "confirmation") -> dict:
	"""Everything the Send menu needs: the guest's phone and email, the text for the chosen document, what was
	sent before, and whether the booking changed since the last confirmation."""
	kind = _kind(kind)
	res = _reservation(reservation)
	f = facts(res)
	history = _history(reservation)
	return {"phone": f["phone"], "email": f["email"], "guest": f["guest"], "booking": f["booking"], "kind": kind,
	        "message": message_text(f, kind, precheckin_link(res) if kind == "pre-arrival" else ""),
	        "history": history, "stale": _stale(res, history), "kinds": KINDS}


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def log_sent(reservation: str, kind: str, channel: str) -> dict:
	"""Remember that the desk sent a document, so the next person sees it on the booking."""
	kind = _kind(kind)
	if channel not in CHANNELS:
		frappe.throw(_("{0} is not a way to send a document.").format(channel))
	res = _reservation(reservation)
	f = facts(res)
	_remember(res, kind, channel, f["email"] if channel == "Email" else f["phone"] if channel == "WhatsApp" else "")
	history = _history(reservation)
	return {"history": history, "stale": _stale(res, history)}


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def save_contact(reservation: str, phone: str | None = None, email: str | None = None) -> dict:
	"""Save the guest's phone and email from the reservation screen."""
	res = _reservation(reservation)
	if not res.guest:
		frappe.throw(_("This booking has no guest profile."))
	email = (email or "").strip()
	phone = (phone or "").strip()
	if email and not validate_email_address(email):
		frappe.throw(_("{0} is not a valid email address.").format(email))
	if phone and len(re.sub(r"\D", "", phone)) < 6:
		frappe.throw(_("Type the phone number with its digits."))
	guest = frappe.get_doc("Guest", res.guest)
	guest.phone = phone or None
	guest.email = email or None
	guest.save()
	return {"phone": guest.phone or "", "email": guest.email or "", "phone_key": to_key(guest.phone, property_region(res.property)) if guest.phone else ""}


def _pdf(res, kind: str = "confirmation") -> bytes:
	from frappe.utils.pdf import get_pdf

	return get_pdf(confirmation_html(facts(res), kind))


@frappe.whitelist()
@require_roles(*ROLES)
def download(reservation: str, kind: str = "confirmation"):
	"""The confirmation, or the amended confirmation, as a PDF file."""
	kind = _kind(kind)
	if kind == "pre-arrival":
		frappe.throw(_("The pre-arrival message is sent by WhatsApp or email, not as a file."))
	res = _reservation(reservation)
	_remember(res, kind, "Download")
	frappe.local.response.filename = f"{res.name}-{kind}.pdf"
	frappe.local.response.filecontent = _pdf(res, kind)
	frappe.local.response.type = "pdf"


@frappe.whitelist(methods=["POST"])
@require_roles(*ROLES)
def send_email(reservation: str, to: str | None = None, kind: str = "confirmation") -> dict:
	"""Email a document, with the PDF attached for a confirmation, from the site's outgoing email."""
	kind = _kind(kind)
	res = _reservation(reservation)
	f = facts(res)
	to = (to or f["email"] or "").strip()
	if not to or not validate_email_address(to):
		frappe.throw(_("Add the guest's email address first."))
	if not frappe.db.exists("Email Account", {"enable_outgoing": 1}) and not frappe.conf.get("mail_server"):
		frappe.throw(_("Outgoing email is not set up on this site. Ask the administrator to add an email account."))
	if kind == "pre-arrival":
		message = escape_html(message_text(f, kind, precheckin_link(res))).replace("\n", "<br>")
		attachments = []
	else:
		message = confirmation_html(f, kind)
		attachments = [{"fname": f"{res.name}-{kind}.pdf", "fcontent": _pdf(res, kind)}]
	frappe.sendmail(
		recipients=[to],
		subject=f"{_(KINDS[kind])} {res.name} - {f['hotel']}",
		message=message,
		attachments=attachments,
		reference_doctype="Reservation",
		reference_name=res.name,
		now=False,
	)
	_remember(res, kind, "Email", to)
	return {"queued": True, "to": to}
