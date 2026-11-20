/*  "Extra charges" in the check-out panel (Kamra Custom): airport drop, laundry, a tour. Pick a quick
    item or type one, give the amount and the GST percentage, and the GST is added on top of the amount.
    The charge goes on the guest's bill at once, so the amount to collect updates. */

import { useEffect, useState } from "react"
import { call, getCurrentProperty } from "../lib/api"
import { serverError } from "../lib/resource"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { lineProblem, lineTotals, toPayload, type ExtraLine } from "./extraCharges"

interface Catalog {
  items: { name: string; experience_name: string; category: string | null; price: number; gst_rate: number }[]
  gst_rates: number[]
}

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

/** `inline`: no button; the form is always open, as a row under the bill (the Full form check-out). */
export function ExtraCharges(props: { folio: string | null; money: (n: number) => string; onPosted: () => void; inline?: boolean }) {
  const { t } = useT()
  const [openState, setOpen] = useState(false)
  const open = !!props.inline || openState
  const [cat, setCat] = useState<Catalog | null>(null)
  const empty: ExtraLine = { description: "", amount: "", gst: "18" }
  const [line, setLine] = useState<ExtraLine>(empty)
  const [added, setAdded] = useState<{ text: string; total: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || cat) return
    call<Catalog>("kamra_custom.extras.catalog", { property: getCurrentProperty() })
      .then(setCat)
      .catch((e) => setError(serverError(e)))
  }, [open, cat])

  if (!props.folio) return null
  const rates = cat?.gst_rates ?? []
  const totals = lineTotals(line.amount, line.gst)
  const problem = lineProblem(line, rates)

  async function add() {
    if (!props.folio || problem) return
    setBusy(true)
    setError("")
    try {
      await call("kamra_custom.extras.post_extras", { folio: props.folio, items: [toPayload(line)] })
      setAdded((a) => [...a, { text: line.description.trim(), total: totals.total }])
      setLine(empty)
      props.onPosted()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      {!props.inline && <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium",
          open ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
        )}
      >
        {t("Add extra charges (airport drop, laundry, tour…)")}
      </button>}
      {open && (
        <div className={cn("space-y-3 rounded-xl p-3", props.inline ? "border border-dashed border-brand-300 bg-brand-50/30" : "border border-zinc-200 bg-white")}>
          {props.inline && <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("Add a charge to this bill")}</p>}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("Quick items")}>
            {(cat?.items ?? []).map((i) => (
              <button
                key={i.name}
                type="button"
                onClick={() => setLine({ description: i.experience_name, amount: String(i.price), gst: String(i.gst_rate) })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                {i.experience_name}
              </button>
            ))}
            <button type="button" onClick={() => setLine(empty)} className="rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
              {t("Custom item")}
            </button>
          </div>
          <div className={cn("grid gap-2", props.inline ? "sm:grid-cols-[1fr_7rem_6rem]" : "sm:grid-cols-[1fr_8rem_7rem]")}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">{t("Item")}</span>
              <input className={field} value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} placeholder={t("e.g. Airport drop")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">{t("Amount")}</span>
              <input className={field} inputMode="decimal" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">{t("GST %")}</span>
              {rates.length ? (
                <select className={field} value={line.gst} onChange={(e) => setLine({ ...line, gst: e.target.value })}>
                  {!rates.includes(Number(line.gst)) && <option value={line.gst}>{line.gst || "-"}</option>}
                  {rates.map((r) => (
                    <option key={r} value={String(r)}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={field} inputMode="decimal" value={line.gst} onChange={(e) => setLine({ ...line, gst: e.target.value })} />
              )}
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm tabular-nums text-zinc-700" aria-live="polite">
              {props.money(totals.net)} + {line.gst || 0}% GST {props.money(totals.gst)} = <b>{props.money(totals.total)}</b>
            </p>
            <div className="flex items-center gap-3">
              {problem && line.description.trim() !== "" && line.amount.trim() !== "" ? <span className="text-xs font-medium text-amber-700">{t(problem)}</span> : null}
              <button
                type="button"
                disabled={busy || !!problem}
                onClick={add}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("Adding…") : t("Add to bill")}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {added.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm" aria-label={t("Added to the bill")}>
              {added.map((a, i) => (
                <li key={i} className="flex justify-between px-3 py-1.5">
                  <span>{a.text}</span>
                  <span className="tabular-nums">{props.money(a.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-zinc-500">{t("To correct a charge, open the bill and void it there.")}</p>
        </div>
      )}
    </section>
  )
}
