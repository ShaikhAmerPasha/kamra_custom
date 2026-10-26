app_name = "kamra_custom"
app_title = "Kamra Custom"
app_publisher = "Zohra Orphanage"
app_description = "Custom front desk changes for Kamra PMS"
app_email = "erp@zohraorphanage.org"
app_license = "mit"

# Apps
# ------------------

required_apps = ["kamra"]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "kamra_custom",
# 		"logo": "/assets/kamra_custom/logo.png",
# 		"title": "Kamra Custom",
# 		"route": "/kamra_custom",
# 		"has_permission": "kamra_custom.api.permission.has_app_permission",
# 	}
# ]

# The dock, the rail down the left of the desk, is a document rather than a hook. Author it in
# Manage Dock on a developer-mode site and press Export to App, and it is written to
# `kamra_custom/dock/kamra_custom/kamra_custom.json` for git to carry. An app that ships none has no
# rail: its sidebar gets a switcher in the header instead.
#
# A companion app, one that extends a host app rather than standing on its own, says so with
# `mount_on` on that same record, and its entries are appended to the host's rail. Mounting keeps
# the companion off the apps screen, so it takes precedence over any add_to_apps_screen above.

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/kamra_custom/css/kamra_custom.css"
# app_include_js = "/assets/kamra_custom/js/kamra_custom.js"

# include js, css files in header of web template
# web_include_css = "/assets/kamra_custom/css/kamra_custom.css"
# web_include_js = "/assets/kamra_custom/js/kamra_custom.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "kamra_custom/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_kanban_js = {"doctype" : "public/js/doctype_kanban.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "kamra_custom/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "kamra_custom.utils.jinja_methods",
# 	"filters": "kamra_custom.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "kamra_custom.install.before_install"
# after_install = "kamra_custom.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "kamra_custom.uninstall.before_uninstall"
# after_uninstall = "kamra_custom.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "kamra_custom.utils.before_app_install"
# after_app_install = "kamra_custom.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "kamra_custom.utils.before_app_uninstall"
# after_app_uninstall = "kamra_custom.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "kamra_custom.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "kamra_custom.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["kamra_custom.search.awesomebar_results"]

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"kamra_custom.tasks.all"
# 	],
# 	"daily": [
# 		"kamra_custom.tasks.daily"
# 	],
# 	"hourly": [
# 		"kamra_custom.tasks.hourly"
# 	],
# 	"weekly": [
# 		"kamra_custom.tasks.weekly"
# 	],
# 	"monthly": [
# 		"kamra_custom.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "kamra_custom.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "kamra_custom.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "kamra_custom.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "kamra_custom.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["kamra_custom.utils.before_request"]
# after_request = ["kamra_custom.utils.after_request"]

# Job Events
# ----------
# before_job = ["kamra_custom.utils.before_job"]
# after_job = ["kamra_custom.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"kamra_custom.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []



# Schema we add to Kamra: one column, two indexes. Re-applied after every migrate.
after_install = "kamra_custom.setup.after_install"
after_migrate = ["kamra_custom.setup.after_migrate"]

# Keep each guest's phone key in step with the phone number.
doc_events = {
	"Guest": {"before_save": "kamra_custom.guests.set_phone_key"},
	"POS Order": {"before_save": "kamra_custom.complimentary.restaurant_nc"},
	"Reservation": {
		"before_insert": "kamra_custom.assign.release_room",
		"validate": "kamra_custom.assign.require_clean_room",
	},
}

# Serve Kamra's own app, built with our patches (ui/), in place of the stock build.
page_renderer = ["kamra_custom.render.KamraPatchedPage"]

# Kamra's booking calls, with the extras the customised booking dialog sends.
override_whitelisted_methods = {
	"kamra.api.create_booking": "kamra_custom.overrides.create_booking",
	"kamra.api.create_group_booking": "kamra_custom.overrides.create_group_booking",
	"kamra.api.walk_in": "kamra_custom.overrides.walk_in",
}
