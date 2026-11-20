/*  Words for the stay trail and the nightly price table (Kamra Custom). Pure, so they can be tested. */

export interface Trail {
  reserved_by: string
  reserved_at: string
  changed_by: string
  changed_at: string
  checked_in_by: string
  checked_in_at: string
  checked_out_at: string
}

export interface NightRow {
  date: string | null
  label?: string
  room: number
  meal: number
  tax: number
  total: number
  gst_rate: number
}

/** "2026-11-20 10:27" → "20 Nov 10:27". Anything else comes back as it is. */
export function when(stamp: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(stamp ?? "")
  if (!m) return stamp ?? ""
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} ${m[4]}`
}

/** One line: who reserved, who last changed it, who checked in. Parts with no data are left out. */
export function trailLine(t: Trail): string {
  const parts: string[] = []
  if (t.reserved_by) parts.push(`Reserved by ${t.reserved_by}${t.reserved_at ? ` on ${when(t.reserved_at)}` : ""}`)
  // a change at the same minute as the booking is the booking itself
  if (t.changed_by && t.changed_at && t.changed_at !== t.reserved_at)
    parts.push(`last changed by ${t.changed_by} on ${when(t.changed_at)}`)
  if (t.checked_in_by || t.checked_in_at)
    parts.push(`checked in${t.checked_in_by ? ` by ${t.checked_in_by}` : ""}${t.checked_in_at ? ` on ${when(t.checked_in_at)}` : ""}`)
  if (t.checked_out_at) parts.push(`checked out on ${when(t.checked_out_at)}`)
  if (!parts.length) return ""
  const s = parts.join(" · ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** True when the rows show more than one rate, so the table is worth opening. */
export const ratesVary = (rows: NightRow[]) =>
  new Set(rows.filter((r) => r.date).map((r) => r.room)).size > 1
