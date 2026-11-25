/*  Internal remarks and the agreed rate, on Kamra's reservation screen
    (Kamra Custom). Self-contained: it reads kamra_custom.reservations.detail,
    saves through our endpoints, and asks the screen to refresh so Kamra's own
    totals follow. */

import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { fmtMoney } from "../lib/money"
import { ApproverSelect } from "./ApproverSelect"
import { copyInitial } from "./hold"
import { BillingFields } from "./BillingFields"
import { EMPTY_BILLING, auditParts, billingFromServer, billingProblem, billingSave, sameBilling, type AuditLine, type Billing } from "./billing"
import { agreedRates, emptyRate, nightsBetween, rateProblem, type PreviewInfo, type RoomRate } from "./rates"

interface Detail {
  reservation: string
  status: string
  guest: string | null
  guest_name: string
  phone: string | null
  property: string
  room_type: string
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
  meal_plan: string | null
  amount_after_tax: number
  advance_paid: number
  night_rates: { date: string; rate: number; gst_rate: number; meal?: number }[]
  rate_negotiated: number
  negotiated_reason: string | null
  rate_approved_by: string | null
  internal_remarks: string | null
  special_requests: string | null
  rate_locked_reason: string | null
}
interface Preview extends PreviewInfo {
  system: { amount_after_tax: number }
  negotiated: { amount_after_tax: number } | null
  limit_pct: number
}

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
const box = "rounded-xl border border-zinc-200 bg-white p-4 space-y-3"

function message(e: unknown): string {
  try {
    const body = JSON.parse((e as { body?: string }).body ?? "")
    const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
    const text = msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "")
    if (text) return text
  } catch {
    /* not a Frappe error body */
  }
  return "That did not work."
}

export function CustomReservationPanel({ name, onChanged }: { name: string; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [remarks, setRemarks] = useState("")
  const [rate, setRate] = useState<RoomRate>(emptyRate())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [billing, setBilling] = useState<Billing>(EMPTY_BILLING)
  const [savedBilling, setSavedBilling] = useState<Billing>(EMPTY_BILLING)
  const [audit, setAudit] = useState<AuditLine | null>(null)
  const [billingEditable, setBillingEditable] = useState(false)
  const shell = useOutletContext<{ openBooking?: (i: Record<string, unknown>) => void; canBook?: boolean } | undefined>()

  const loadBilling = useCallback(() => {
    call<{ editable: boolean; values: Record<string, unknown>; audit: AuditLine }>("kamra_custom.analysis.get", { reservation: name })
      .then((x) => {
        const b = billingFromServer(x.values)
        setBilling(b)
        setSavedBilling(b)
        setAudit(x.audit)
        setBillingEditable(x.editable)
      })
      .catch(() => setAudit(null))
  }, [name])
  useEffect(loadBilling, [loadBilling])

  const load = useCallback(() => {
    call<Detail>("kamra_custom.reservations.detail", { reservation: name })
      .then((x) => {
        setD(x)
        setRemarks(x.internal_remarks ?? "")
        setRate({ ...emptyRate(), nightly: x.night_rates.map((n) => String(n.rate + (n.meal ?? 0))), rate: String((x.night_rates[0]?.rate ?? 0) + (x.night_rates[0]?.meal ?? 0)) })
      })
      .catch(() => setD(null))
  }, [name])
  useEffect(load, [load])

  const nights = d ? nightsBetween(d.check_in_date, d.check_out_date) : 0
  const rates = agreedRates(rate, nights)

  useEffect(() => {
    if (!d || nights < 1 || !rate.agree) return setPreview(null)
    let alive = true
    const timer = setTimeout(() => {
      call<Preview>("kamra_custom.negotiation.preview", {
        property: d.property, room_type: d.room_type, check_in_date: d.check_in_date, check_out_date: d.check_out_date,
        adults: d.adults, children: d.children, meal_plan: d.meal_plan || undefined, rates, all_in: 1,
      })
        .then((p) => alive && setPreview(p))
        .catch((e) => alive && setError(message(e)))
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, rate.agree, JSON.stringify(rates)])

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    setError("")
    setNote("")
    try {
      await fn()
      setNote(done)
      load()
      loadBilling()
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  if (!d) return null
  const problem = rateProblem(rate, nights, preview ?? undefined)
  const hasMeal = d.night_rates.some((n) => (n.meal ?? 0) > 0)
  const remarksChanged = remarks !== (d.internal_remarks ?? "")

  return (
    <div className="space-y-4">
      <div className={box} aria-label="Internal remarks">
        <h3 className="text-sm font-semibold">Internal remarks</h3>
        <p className="text-xs text-zinc-500">For staff only. Never printed on an invoice or registration card.</p>
        <textarea rows={2} className={field} value={remarks} onChange={(e) => setRemarks(e.target.value)}
          placeholder="For example advance taken, who agreed the rate" />
        {remarksChanged ? (
          <Button variant="outline" disabled={busy}
            onClick={() => run(() => call("kamra_custom.reservations.save_remarks", {
              reservation: name, booking_instructions: d.special_requests ?? "", internal_remarks: remarks,
            }), "Remarks saved.")}>
            Save remarks
          </Button>
        ) : null}
      </div>

      {shell?.openBooking && shell.canBook !== false ? (
        <div className="flex items-center gap-3 text-sm">
          <Button variant="outline" onClick={() => shell.openBooking?.(copyInitial(d, new Date().toLocaleDateString("en-CA")))}>
            Copy this booking
          </Button>
          <span className="text-xs text-zinc-500">Starts a new booking for the same guest, room type and party. Nothing is booked until you confirm.</span>
        </div>
      ) : null}

      <div className={box} aria-label="Billing and analysis">
        <h3 className="text-sm font-semibold">Billing and analysis</h3>
        <BillingFields idPrefix="stay" value={billing} onChange={(p) => setBilling((b) => ({ ...b, ...p }))} disabled={!billingEditable} />
        {billingProblem(billing) ? <p role="alert" className="text-sm text-rose-700">{billingProblem(billing)}</p> : null}
        {billingEditable && !sameBilling(billing, savedBilling) ? (
          <Button variant="outline" disabled={busy || billingProblem(billing) !== ""}
            onClick={() => run(() => call("kamra_custom.analysis.save", { reservation: name, values: billingSave(billing) }), "Billing details saved.")}>
            Save billing details
          </Button>
        ) : null}
        {!billingEditable && audit ? <p className="text-xs text-zinc-500">This booking is closed, so these details can no longer change.</p> : null}
      </div>

      <div className={box} aria-label="Agreed rate">
        <h3 className="text-sm font-semibold">Rate</h3>
        <p className="text-sm">
          Total <b>{fmtMoney(d.amount_after_tax)}</b> with tax
          {d.rate_negotiated ? (
            <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
              Agreed rate{d.rate_approved_by ? ` · approved by ${d.rate_approved_by}` : ""}{d.negotiated_reason ? ` · ${d.negotiated_reason}` : ""}
            </span>
          ) : null}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-1">Night</th>
              {/* the meal is part of the rate: one column, never room and meal apart */}
              <th className="py-1 text-right">{hasMeal ? "Rate" : "Room"}</th><th className="py-1 text-right">Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {d.night_rates.map((n) => (
              <tr key={n.date}><td className="py-1">{n.date}</td><td className="py-1 text-right">{fmtMoney(n.rate + (n.meal ?? 0))}</td>
                <td className="py-1 text-right">{n.gst_rate}%</td></tr>
            ))}
          </tbody>
        </table>

        {d.rate_locked_reason ? (
          <p className="text-sm text-amber-800">{d.rate_locked_reason}</p>
        ) : (
          <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rate.agree} onChange={(e) => setRate((r) => ({ ...r, agree: e.target.checked, perNight: true }))} />
              Change the rate
            </label>
            {rate.agree ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {d.night_rates.map((n, i) => (
                    <div key={n.date}>
                      <label className={label} htmlFor={`custom-edit-night-${i}`}>{n.date}{hasMeal ? " · room + meal" : ""}</label>
                      <input id={`custom-edit-night-${i}`} inputMode="decimal" className={field} value={rate.nightly[i] ?? ""}
                        onChange={(e) => setRate((r) => ({ ...r, nightly: Object.assign([...r.nightly], { [i]: e.target.value }) }))} />
                    </div>
                  ))}
                </div>
                {preview ? (
                  <p className="text-zinc-700">
                    New total <b>{fmtMoney(preview.negotiated?.amount_after_tax ?? preview.system.amount_after_tax)}</b>
                    {preview.discount_pct > 0 ? ` · ${preview.discount_pct.toFixed(1)}% below the system rate` : ""}
                  </p>
                ) : null}
                {preview && preview.discount_pct > 0 ? (
                  <div>
                    <ApproverSelect id="custom-edit-approver" value={rate.approver} onChange={(v) => setRate((r) => ({ ...r, approver: v }))} />
                    <label className={`${label} mt-2`} htmlFor="custom-edit-why">Note (optional)</label>
                    <input id="custom-edit-why" className={field} value={rate.reason} onChange={(e) => setRate((r) => ({ ...r, reason: e.target.value }))} />
                  </div>
                ) : null}
                {problem ? <p role="alert" className="text-rose-700">{problem}</p> : null}
                <Button disabled={busy || !rates || problem !== ""}
                  onClick={() => run(() => call("kamra_custom.negotiation.set_negotiated_rate", { reservation: name, rates, reason: rate.reason.trim(), approver: rate.approver.trim(), all_in: 1 }), "Rate saved.")}>
                  Save rate
                </Button>
              </>
            ) : null}
          </div>
        )}
        {note ? <p role="status" className="text-sm text-emerald-700">{note}</p> : null}
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      </div>

      {audit ? (
        <dl aria-label="History" className="flex flex-wrap gap-x-6 gap-y-1 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
          {auditParts(audit).map(([k, v]) => (
            <div key={k} className="flex gap-1"><dt className="font-medium">{k}:</dt><dd>{v || "-"}</dd></div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
