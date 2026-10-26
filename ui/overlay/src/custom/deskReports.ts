export interface ReportSpec {
  key: string
  title: string
  /** From and To dates, or a single date. */
  range: boolean
  plan: boolean
  approver: boolean
}
export interface ReportCatalog {
  reports: ReportSpec[]
  plans: string[]
  approvers: string[]
}
export interface DeskReport {
  report: string
  title: string
  property: string
  when: string
  summary: string[]
  columns: { key: string; label: string; type: "text" | "number" | "money" | "date" }[]
  rows: Record<string, string | number | null>[]
}
export interface ReportFilters {
  report: string
  property: string
  from_date: string
  to_date: string
  plan: string
  approver: string
}

/** Today in the browser's calendar, as YYYY-MM-DD. */
export const today = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Where the Excel file comes from: the server builds it from the same filters. */
export function reportDownloadUrl(f: ReportFilters): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v)
  return `/api/method/kamra_custom.desk_reports.download?${q.toString()}`
}
