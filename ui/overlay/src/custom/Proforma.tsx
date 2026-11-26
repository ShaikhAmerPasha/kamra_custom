/*  Proforma invoice (Kamra Custom): a button that opens what a booking, or a whole group, is projected to
    cost, summed the way MyCloud offers (none, charge, date, date and charge), with a Print button.
    Nothing is posted; the total is the booking's own total. */

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { fmtMoney } from "../lib/money"
import { useBackClose } from "./useBackClose"
import { SUMMARY_MODES, allLines, rateText, summarise, type PfLine, type SummaryMode } from "./proforma"
import "./desk.css"

interface Stay { reservation: string; guest_name: string; room_type: string; room: string | null; check_in_date: string; check_out_date: string; lines: PfLine[]; total: number }
interface Data {
  hotel: { name: string; gstin?: string; phone?: string; email?: string; address?: string }
  group?: { group_name: string; company: string | null; check_in_date: string; check_out_date: string }
  stays: Stay[]
  amount: number; tax: number; total: number; paid: number; balance: number
}
const day = (d: string) => (d ? d.split("-").reverse().join("/") : "")

function Card({ data, onClose }: { data: Data; onClose: () => void }) {
  const [mode, setMode] = useState<SummaryMode>("none")
  useBackClose(onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  const multi = data.stays.length > 1
  const lines = summarise(allLines(data.stays), mode)
  const title = data.group ? data.group.group_name : data.stays[0]?.guest_name
  return (
    <div className="kd kd-modal kd-proforma-modal" role="dialog" aria-modal="true" aria-label="Proforma invoice" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kd-pop kd-pop-wide kd-proforma">
        <div className="kd-pop-head">Proforma invoice</div>
        <div className="kd-pop-body" style={{ display: "block" }}>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold">{data.hotel.name}</p>
              {data.hotel.address ? <p>{data.hotel.address}</p> : null}
              <p>{[data.hotel.gstin && `GSTIN ${data.hotel.gstin}`, data.hotel.phone, data.hotel.email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{title}</p>
              <p>{day(data.group?.check_in_date ?? data.stays[0]?.check_in_date ?? "")} – {day(data.group?.check_out_date ?? data.stays[0]?.check_out_date ?? "")}</p>
              <p>{multi ? `${data.stays.length} rooms` : data.stays[0] ? `${data.stays[0].room_type}${data.stays[0].room ? ` · ${data.stays[0].room}` : ""}` : ""}</p>
            </div>
          </div>
          <div role="radiogroup" aria-label="Summarised by" className="kd-noprint mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span>Summarised by</span>
            {SUMMARY_MODES.map(([k, l]) => (
              <label key={k} className="flex items-center gap-1"><input type="radio" name="pf-mode" checked={mode === k} onChange={() => setMode(k)} />{l}</label>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-1">Date</th><th>Charge</th><th>Description</th><th className="text-right">Amount</th><th className="text-right">Tax</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="py-0.5 whitespace-nowrap">{day(l.date)}</td><td>{l.code}</td><td>{l.description}</td>
                  <td className="text-right">{fmtMoney(l.amount)}</td><td className="text-right">{fmtMoney(l.tax)} <span className="text-xs text-zinc-500">{rateText(l.tax_rate)}</span></td>
                  <td className="text-right">{fmtMoney(l.total)}</td>
                </tr>
              ))}
              {!lines.length ? <tr><td colSpan={6} className="py-3 text-center text-zinc-500">Nothing is projected for this booking.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="pt-1 text-right font-medium">Total</td><td className="pt-1 text-right">{fmtMoney(data.amount)}</td><td className="pt-1 text-right">{fmtMoney(data.tax)}</td><td className="pt-1 text-right font-semibold">{fmtMoney(data.total)}</td></tr>
              <tr><td colSpan={5} className="text-right">Paid</td><td className="text-right">{fmtMoney(data.paid)}</td></tr>
              <tr><td colSpan={5} className="text-right font-medium">Balance</td><td className="text-right font-semibold">{fmtMoney(data.balance)}</td></tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-zinc-500">A projection of the booking as it stands. Nothing here has been billed.</p>
        </div>
        <div className="kd-pop-foot kd-noprint gap-2">
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export function ProformaButton(props: { kind: "reservation" | "group"; id: string; label?: string; disabled?: boolean; className?: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function open() {
    setBusy(true)
    setError("")
    try {
      setData(await call<Data>(props.kind === "group" ? "kamra_custom.proforma.group" : "kamra_custom.proforma.reservation", props.kind === "group" ? { group_booking: props.id } : { reservation: props.id }))
    } catch {
      setError("The proforma did not load.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="outline" className={props.className} disabled={props.disabled || busy} onClick={open}>{busy ? "Loading…" : (props.label ?? "Proforma invoice")}</Button>
      {error ? <span role="alert" className="text-xs text-rose-700">{error}</span> : null}
      {data ? createPortal(<Card data={data} onClose={() => setData(null)} />, document.body) : null}
    </>
  )
}
