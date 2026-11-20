/*  Under the stay details (Kamra Custom): the price night by night behind a button, and a one-line
    trail of who reserved, changed and checked in the booking. */

import { useEffect, useState } from "react"
import { call } from "../lib/api"
import { useT } from "../lib/i18n"
import { cur } from "../lib/money"
import { cn } from "../lib/utils"
import { ratesVary, trailLine, when, type NightRow, type Trail } from "./stayFacts"
import { showDate } from "./showDate"

interface Facts {
  nightly: NightRow[]
  total: number
  agreed: boolean
  agreed_by: string
  trail: Trail
}

const money = (n: number) => `${cur()}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function StayFacts(props: { reservation: string }) {
  const { t } = useT()
  const [facts, setFacts] = useState<Facts | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setFacts(null)
    call<Facts>("kamra_custom.stay_facts.stay_facts", { reservation: props.reservation })
      .then((f) => alive && setFacts(f))
      .catch(() => alive && setFacts(null))
    return () => {
      alive = false
    }
  }, [props.reservation])

  if (!facts) return null
  const line = trailLine(facts.trail)
  const cell = "px-2 py-1 text-right tabular-nums"
  return (
    <div className="space-y-2">
      {facts.nightly.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
              open ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {t("Price night by night")}
            {facts.agreed && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">{t("agreed rate")}</span>}
          </button>
          {open && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-1 text-left font-medium">{t("Night")}</th>
                    <th className={cn(cell, "font-medium")}>{t("Room")}</th>
                    <th className={cn(cell, "font-medium")}>{t("Meals")}</th>
                    <th className={cn(cell, "font-medium")}>{t("Tax")}</th>
                    <th className={cn(cell, "font-medium")}>{t("Total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {facts.nightly.map((r, i) => (
                    <tr key={r.date ?? `o${i}`}>
                      <td className="px-2 py-1">{r.date ? showDate(r.date) : t("Discount and other")}</td>
                      <td className={cell}>{r.date ? money(r.room) : ""}</td>
                      <td className={cell}>{r.date && r.meal ? money(r.meal) : r.date ? "-" : ""}</td>
                      <td className={cell}>{r.date ? `${money(r.tax)} (${r.gst_rate}%)` : ""}</td>
                      <td className={cn(cell, "font-medium")}>{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 font-semibold">
                    <td className="px-2 py-1" colSpan={4}>{t("Stay total, tax included")}</td>
                    <td className={cell}>{money(facts.total)}</td>
                  </tr>
                </tfoot>
              </table>
              {facts.agreed && (
                <p className="px-2 pb-2 text-xs text-zinc-500">
                  {t("This is the agreed rate")}{facts.agreed_by ? ` (${facts.agreed_by})` : ""}.
                  {ratesVary(facts.nightly) ? ` ${t("The rate changes between nights.")}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {line && <p className="text-xs text-zinc-500" title={when(facts.trail.changed_at)}>{line}</p>}
    </div>
  )
}
