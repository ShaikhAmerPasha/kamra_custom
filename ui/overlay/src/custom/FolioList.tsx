/*  The Billing list (Kamra Custom): search, a date range, and one row per stay with its folios
    grouped. A stay with several folios opens into one line for each, each with its own invoice
    and PDF. The rows come from kamra_custom.billing.stays. */

import { Fragment, useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, ChevronRight, FileText, Search } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { toFullPath } from "../lib/routing"
import { fmtMoney } from "../lib/money"
import { Button } from "../components/ui/button"
import { foliosLabel, folioPath, pdfPath, rangeProblem, type BillRow } from "./billingList"

const input =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
const PAGE = 50

interface Page {
  rows: BillRow[]
  total: number
}

export function FolioList() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [status, setStatus] = useState("")
  const [rows, setRows] = useState<BillRow[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const problem = rangeProblem(from, to)

  const load = useCallback(
    async (start: number) => {
      setBusy(true)
      setError("")
      try {
        const page = await call<Page>("kamra_custom.billing.stays", {
          property: getCurrentProperty(), q, date_from: from || undefined, date_to: to || undefined, status, start, limit: PAGE,
        })
        setRows((old) => (start === 0 ? page.rows : [...old, ...page.rows]))
        setTotal(page.total)
      } catch {
        setError("The list could not be loaded.")
      } finally {
        setBusy(false)
      }
    },
    [q, from, to, status],
  )

  useEffect(() => {
    if (problem) return
    const t = setTimeout(() => void load(0), 250)
    return () => clearTimeout(t)
  }, [load, problem])

  const day = (d: string) => (d ? d : "-")
  const pdf = (folio: string) => window.open(toFullPath(pdfPath(folio)), "_blank", "noopener")

  return (
    <div className="rounded-xl border border-zinc-200 bg-white" data-testid="folio-list">
      <div className="space-y-3 border-b border-zinc-100 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="bill-q" className={label}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input id="bill-q" className={`${input} w-full pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, booking ID or PNR, invoice or folio number" />
            </div>
          </div>
          <div>
            <label htmlFor="bill-from" className={label}>Bill date from</label>
            <input id="bill-from" type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="bill-to" className={label}>to</label>
            <input id="bill-to" type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="bill-status" className={label}>Status</label>
            <select id="bill-status" className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          {(q || from || to || status) && (
            <Button variant="outline" onClick={() => { setQ(""); setFrom(""); setTo(""); setStatus("") }}>Clear</Button>
          )}
        </div>
        {problem ? <p role="alert" className="text-sm text-rose-700">{problem}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="py-2 pl-4 pr-3">Guest</th>
              <th className="py-2 pr-3">Check-in</th>
              <th className="py-2 pr-3">Check-out</th>
              <th className="py-2 pr-3">Bill date</th>
              <th className="py-2 pr-3 text-right">Invoice amount</th>
              <th className="py-2 pr-3">Payment mode</th>
              <th className="py-2 pr-3 text-right">Paid</th>
              <th className="py-2 pr-3 text-right">Balance</th>
              <th className="py-2 pr-3">Book through</th>
              <th className="py-2 pr-3">Booking ID</th>
              <th className="py-2 pr-4">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const many = r.folios.length > 1
              const expanded = open === r.key
              return (
                <Fragment key={r.key}>
                  <tr
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => (many ? setOpen(expanded ? null : r.key) : navigate(folioPath(r.folios[0].name)))}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {many ? (expanded ? <ChevronDown className="size-4 text-zinc-400" aria-hidden /> : <ChevronRight className="size-4 text-zinc-400" aria-hidden />) : null}
                        {r.guest}
                        {many ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">{foliosLabel(r)}</span> : null}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{day(r.check_in)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{day(r.check_out)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{day(r.bill_date)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                    <td className="py-2.5 pr-3">{r.payment_modes || "-"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoney(r.paid)}</td>
                    <td className={"py-2.5 pr-3 text-right font-medium tabular-nums " + (r.balance > 0.005 ? "text-amber-600" : "text-emerald-600")}>{fmtMoney(r.balance)}</td>
                    <td className="py-2.5 pr-3">{r.booked_through}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.booking_id || "-"}</td>
                    <td className="py-2.5 pr-4">
                      {many ? (
                        <span className="text-zinc-400">{r.folios.filter((f) => f.invoice_number).length} of {r.folios.length}</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-zinc-500">{r.folios[0].invoice_number || "-"}</span>
                          <button type="button" aria-label={`PDF of ${r.folios[0].name}`} title="Open and print or save as PDF"
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-100" onClick={(e) => { e.stopPropagation(); pdf(r.folios[0].name) }}>
                            <FileText className="size-4" aria-hidden />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {many && expanded
                    ? r.folios.map((f) => (
                        <tr key={f.name} className="bg-zinc-50/70 text-xs">
                          <td className="py-2 pl-10 pr-3 text-zinc-700" colSpan={4}>
                            {f.type} folio · <span className="font-medium">{f.name}</span>
                            <span className={"ms-2 rounded px-1.5 py-0.5 " + (f.status === "Open" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>{f.status}</span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(f.amount)}</td>
                          <td className="py-2 pr-3" />
                          <td className="py-2 pr-3" />
                          <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(f.balance)}</td>
                          <td className="py-2 pr-3" colSpan={2}>{f.invoice_number || "-"}</td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex gap-2">
                              <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => navigate(folioPath(f.name))}>Open</button>
                              <button type="button" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline" onClick={() => pdf(f.name)}>
                                <FileText className="size-3.5" aria-hidden /> PDF
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              )
            })}
            {rows.length === 0 && !busy ? (
              <tr>
                <td colSpan={11} className="py-6 text-center text-zinc-400">
                  {q || from || to || status ? "No bills match." : "No folios yet - they open automatically at check-in."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
        <span>{error || `${rows.length} of ${total} stay${total === 1 ? "" : "s"}`}</span>
        {rows.length < total ? (
          <Button variant="outline" disabled={busy} onClick={() => void load(rows.length)}>{busy ? "Loading…" : "Show more"}</Button>
        ) : null}
      </div>
    </div>
  )
}
