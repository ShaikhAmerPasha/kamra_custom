"""Excel download shared by every report we add.

One place builds the file, so every report gets the same protections: a cell that
starts with = + - or @ is written as text (a guest or staff name must never run as a
formula), and a download is capped so one request cannot exhaust memory.
"""

import io

import frappe
from frappe import _

MAX_ROWS = 20000


def safe_cell(value):
	"""A string that Excel could read as a formula is written as plain text."""
	if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
		return "'" + value
	return value


def build_xlsx(title: str, columns: list[tuple[str, str]], rows: list[dict], subtitle_lines: tuple = ()) -> bytes:
	"""A workbook with a title, optional lines under it, a header row and one row per record.

	`columns` is [(key, heading)]. A missing key is an empty cell.
	"""
	from openpyxl import Workbook

	if len(rows) > MAX_ROWS:
		frappe.throw(_("Too many rows for one download ({0}). Narrow the dates or filters.").format(len(rows)))

	wb = Workbook(write_only=True)
	ws = wb.create_sheet(title=(title or "Report")[:31])
	ws.append([safe_cell(title)])
	for line in subtitle_lines:
		ws.append([safe_cell(line)])
	ws.append([])
	ws.append([safe_cell(label) for _key, label in columns])
	for row in rows:
		ws.append([safe_cell(row.get(key)) for key, _label in columns])
	out = io.BytesIO()
	wb.save(out)
	return out.getvalue()


def send_xlsx(filename: str, content: bytes) -> None:
	"""Make the current request answer with an Excel file."""
	frappe.response["filename"] = filename if filename.endswith(".xlsx") else filename + ".xlsx"
	frappe.response["filecontent"] = content
	frappe.response["type"] = "binary"
