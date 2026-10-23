"""Serve Kamra's front end from our patched build.

Kamra serves its React app at /kamra through a www page. We register a page
renderer, which Frappe tries before its own, to serve the same app built with
our patches (see ui/). Nothing in Kamra changes. The stock page serves again
when the setting is off, when there is no build, or for any path that is not
the Kamra app.
"""

import os

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer

PREFIX = "kamra"


def build_index() -> str:
	return frappe.get_app_path("kamra_custom", "public", "kamra-ui", "index.html")


def enabled() -> bool:
	"""On unless someone turned it off in Kamra Custom Settings."""
	rows = frappe.db.sql(
		"select value from tabSingles where doctype = %s and field = %s",
		("Kamra Custom Settings", "use_patched_ui"),
	)
	return True if not rows or rows[0][0] in (None, "") else bool(int(rows[0][0]))


def is_kamra_path(path: str) -> bool:
	path = (path or "").strip("/")
	return path == PREFIX or path.startswith(PREFIX + "/")


class KamraPatchedPage(BaseRenderer):
	def can_render(self) -> bool:
		return is_kamra_path(self.path) and os.path.exists(build_index()) and enabled()

	def render(self):
		with open(build_index(), encoding="utf-8") as f:  # nosemgrep: frappe-security-file-traversal -- fixed app path, not user input
			html = f.read()
		csrf = frappe.sessions.get_csrf_token()
		html = html.replace("</head>", f'<script>window.csrf_token = "{csrf}";</script></head>', 1)
		return self.build_response(html, headers={"Cache-Control": "no-store"})
