/*  Filters and export for the Activity Log (Kamra Custom). Kept apart from the screen so the
    rules can be tested: what the URL pre-fills, what is sent to the server, how a row becomes a
    spreadsheet line. */

export interface ActivityFilterState {
  search: string
  from: string
  to: string
  record: string
}

export const emptyFilters = (): ActivityFilterState => ({ search: "", from: "", to: "", record: "" })

/** `?record=RES-2026-00056` opens the log already narrowed to one booking. */
export function filtersFromUrl(query: string): ActivityFilterState {
  const q = new URLSearchParams(query)
  return {
    search: q.get("search") ?? "",
    from: /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") ?? "") ? (q.get("from") as string) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(q.get("to") ?? "") ? (q.get("to") as string) : "",
    record: (q.get("record") ?? "").trim(),
  }
}

/** The arguments to add to the server call. Empty filters are left out. */
export function filterArgs(f: ActivityFilterState): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.search.trim()) out.search = f.search.trim()
  if (f.from) out.date_from = f.from
  if (f.to) out.date_to = f.to
  if (f.record.trim()) out.record = f.record.trim()
  return out
}

export const anyFilter = (f: ActivityFilterState) => Object.keys(filterArgs(f)).length > 0

/** The dates are in the wrong order, so nothing could match. */
export const dateProblem = (f: ActivityFilterState) =>
  f.from && f.to && f.from > f.to ? "The start date is after the end date." : ""

export interface CsvRow {
  creation: string
  actor?: string | null
  agent_name?: string | null
  action_type: string
  rationale?: string | null
  reference_name?: string | null
  approval_status?: string | null
}

/** A cell that starts with = + - or @ would run as a formula in a spreadsheet. */
const cell = (v: unknown) => {
  let s = String(v ?? "")
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function activityCsv(rows: CsvRow[]): string {
  const head = ["When", "Who", "Action", "Details", "Record", "Status"]
  const lines = rows.map((r) =>
    [r.creation, r.agent_name || (r.actor ?? "system").split("@")[0], r.action_type, r.rationale, r.reference_name, r.approval_status]
      .map(cell)
      .join(","),
  )
  return [head.map(cell).join(","), ...lines].join("\r\n")
}
