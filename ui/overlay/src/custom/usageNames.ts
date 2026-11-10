// Fixed names for the usage counter: no record names, guest names or amounts.

import { LABELS, type Target } from "./hotkeys"

/** "/billing/FOLIO-2026-01630" -> "/billing/:id", so no record names are stored. */
export function normalizePath(path: string): string {
  const p = path
    .split("?")[0]
    .split("/")
    .map((seg) => (/\d/.test(seg) ? ":id" : seg))
    .join("/")
  return p.replace(/\/+$/, "") || "/"
}

/** The button a click belongs to, as a fixed name, or "" for anything we do not track. */
export function clickAction(label: string): string {
  const text = label.trim()
  if (/^new booking$/i.test(text)) return "click:new-booking"
  for (const t of Object.keys(LABELS) as Target[]) if (LABELS[t].test(text)) return `click:${t}`
  return ""
}

