/*  The filter bar of the Activity Log (Kamra Custom): words, a date range, a record, and a
    download of what is on screen. */

import { Download, X } from "lucide-react"
import { activityCsv, anyFilter, dateProblem, emptyFilters, type ActivityFilterState, type CsvRow } from "./activityFilters"

const field = "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:outline-2 focus:outline-brand-600"

export function ActivityFilters(props: {
  value: ActivityFilterState
  onChange: (f: ActivityFilterState) => void
  rows: CsvRow[]
}) {
  const { value, onChange, rows } = props
  const set = (patch: Partial<ActivityFilterState>) => onChange({ ...value, ...patch })
  const problem = dateProblem(value)

  const download = () => {
    const blob = new Blob(["﻿" + activityCsv(rows)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="act-search" className="mb-0.5 block text-xs text-zinc-500">Search</label>
        <input id="act-search" className={`${field} w-56`} value={value.search} placeholder="Guest, room, payment…"
          onChange={(e) => set({ search: e.target.value })} />
      </div>
      <div>
        <label htmlFor="act-record" className="mb-0.5 block text-xs text-zinc-500">Booking or bill</label>
        <input id="act-record" className={`${field} w-44`} value={value.record} placeholder="RES-2026-00056"
          onChange={(e) => set({ record: e.target.value })} />
      </div>
      <div>
        <label htmlFor="act-from" className="mb-0.5 block text-xs text-zinc-500">From</label>
        <input id="act-from" type="date" className={field} value={value.from} onChange={(e) => set({ from: e.target.value })} />
      </div>
      <div>
        <label htmlFor="act-to" className="mb-0.5 block text-xs text-zinc-500">To</label>
        <input id="act-to" type="date" className={field} value={value.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
      {anyFilter(value) ? (
        <button type="button" className="inline-flex items-center gap-1 px-1 py-1.5 text-sm underline" onClick={() => onChange(emptyFilters())}>
          <X className="size-3.5" aria-hidden /> Clear filters
        </button>
      ) : null}
      <button type="button" disabled={rows.length === 0}
        className={`${field} ml-auto inline-flex items-center gap-1.5 disabled:opacity-50`} onClick={download}
        title="Download the rows on screen as a spreadsheet">
        <Download className="size-3.5" aria-hidden /> Download
      </button>
      {problem ? <p role="alert" className="w-full text-xs text-rose-700">{problem}</p> : null}
    </div>
  )
}
