"""One key per phone number, whatever way it was typed.

`+91 98765 43210`, `098765 43210` and `9876543210` are one number. The key is
the international form without the plus (`919876543210`). It comes from the
`phonenumbers` library (installed with Frappe), using the property's country
to read numbers typed without a country code. A number the library cannot
read keeps its digits, so it still matches itself.
"""

import re

import phonenumbers

_DIGITS = re.compile(r"\D+")


def digits(raw: str | None) -> str:
	return _DIGITS.sub("", raw or "")


def to_key(raw: str | None, region: str | None = None) -> str:
	"""The key for `raw`. `region` is an ISO country code such as "IN"."""
	text = (raw or "").strip()
	if not digits(text):
		return ""
	# "00" is the international prefix in most countries
	if text.startswith("00"):
		text = "+" + text[2:]
	try:
		num = phonenumbers.parse(text, None if text.startswith("+") else (region or None))
		if phonenumbers.is_possible_number(num):
			return f"{num.country_code}{num.national_number}"
	except phonenumbers.NumberParseException:
		pass
	return digits(text)
