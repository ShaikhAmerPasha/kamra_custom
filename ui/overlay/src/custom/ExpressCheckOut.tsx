/*  One-page check-out (Kamra Custom), for the usual stay: the bill, how the guest pays, one button.
    It calls Kamra's own endpoints in Kamra's own order (payment, check-out, invoice), so the
    records are the same as the steps leave. A stay with anything unusual (early leaving, company
    bill, refund, deposit, bills not on the folio, group) opens Kamra's steps instead. */

import { useCallback, useEffect, useState, type ComponentType } from "react"
import { CircleCheck, Printer } from "lucide-react"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { toFullPath } from "../lib/routing"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { checkOutWithCredit } from "../components/CreditCheckout"
import { whyNotExpress, type CheckoutLike } from "./expressCheckOut"

type Props = {
  reservation: string
  onDone: () => void
  onClose: () => void
  onOpenReservation?: (reservation: string) => void
}

interface Ctx extends CheckoutLike {
  reservation: CheckoutLike["reservation"] & { guest_name: string; room_number: string | null; room_type_name: string | null; check_in_date: string; check_out_date: string }
  currency_symbol: string
  payment_modes: string[]
  folios: { folio: string; side: string; status: string; has_charges: boolean; balance: number; invoice_number: string | null }[]
  groups: Record<string, { group: string; amount: number; count: number }>
  totals: { charges: number; paid: number; balance: number }
  collect: { folio: string; amount: number }[]
}

const EPS = 0.005

export default function ExpressCheckOut(props: Props & { Fallback: ComponentType<Props> }) {
  const { t } = useT()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState("")
  const [reference, setReference] = useState("")
  const [steps, setSteps] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    try {
      const c = await call<Ctx>("kamra.api.checkout_context", { reservation: props.reservation })
      setCtx(c)
      setMode((m) => m || c.payment_modes[0] || "")
      return c
    } catch (e) {
      setError(serverError(e))
      return null
    }
  }, [props.reservation])

  useEffect(() => {
    load()
  }, [load])

  if (steps || (ctx && whyNotExpress(ctx) !== "" && done === null)) return <props.Fallback {...props} />
  if (!ctx) {
    return (
      <Sheet wide title={t("Check out")} onClose={props.onClose}>
        {error ? <p role="alert" className="text-rose-700">{error}</p> : <p className="text-zinc-500">{t("Loading…")}</p>}
      </Sheet>
    )
  }

  const r = ctx.reservation
  const cur = ctx.currency_symbol
  const money = (n: number) => `${cur}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const due = ctx.collect.reduce((s, c) => s + c.amount, 0)
  const title = t("Check out {name}", { name: r.guest_name })
  const description = `${t("Room {n}", { n: r.room_number ?? "" })} · ${r.room_type_name ?? ""} · ${r.check_in_date} → ${r.check_out_date}`

  async function checkOut() {
    if (!ctx) return
    setBusy(true)
    setError("")
    try {
      for (const c of ctx.collect) {
        if (c.amount > EPS) {
          await call("kamra.api.add_folio_payment", {
            folio: c.folio, mode, amount: c.amount, kind: "Payment", reference: reference.trim() || undefined,
          })
        }
      }
      await checkOutWithCredit(props.reservation, undefined)
      const fresh = await load()
      const ready = (fresh?.folios ?? []).filter(
        (f) => f.side !== "group" && f.status === "Open" && f.has_charges && Math.abs(f.balance) <= EPS,
      )
      if (fresh?.till_open) for (const f of ready) await call("kamra.api.close_folio", { folio: f.folio })
      const after = await load()
      setDone((after?.folios ?? []).filter((f) => f.side !== "group" && f.has_charges).map((f) => f.folio))
    } catch (e) {
      setError(serverError(e))
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (done !== null) {
    return (
      <Sheet
        wide
        title={title}
        description={description}
        onClose={props.onDone}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {done.map((f) => (
              <a key={f} href={toFullPath(`/billing/${f}`)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <Printer className="size-4" aria-hidden /> {t("Print bill")}
              </a>
            ))}
            <Button className="ms-auto px-6 py-2.5 text-base" onClick={props.onDone}>{t("Done")}</Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-lg font-semibold">{t("{name} is checked out", { name: r.guest_name })}</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      wide
      title={title}
      description={description}
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setSteps(true)}>{t("Use the full steps")}</button>
          <Button variant="outline" className="ms-auto" onClick={props.onClose}>{t("Cancel")}</Button>
          <Button className="px-6 py-2.5 text-base" disabled={busy} onClick={checkOut}>
            {busy ? t("Checking out…") : due > EPS ? t("Collect {amount} and check out", { amount: money(due) }) : t("Check out")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800">{t("Bill")}</h3>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
            {Object.values(ctx.groups).map((g) => (
              <div key={g.group} className="flex justify-between px-4 py-2">
                <span className="text-zinc-700">{t(g.group)}{g.count > 1 ? ` × ${g.count}` : ""}</span>
                <span>{money(g.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 font-medium"><span>{t("Total")}</span><span>{money(ctx.totals.charges)}</span></div>
            <div className="flex justify-between px-4 py-2 text-zinc-600"><span>{t("Paid")}</span><span>{money(ctx.totals.paid)}</span></div>
            <div className={cn("flex justify-between px-4 py-2 text-base font-semibold", due > EPS ? "text-rose-700" : "text-emerald-700")}>
              <span>{t("To collect")}</span><span>{money(due)}</span>
            </div>
          </div>
        </section>

        {due > EPS && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800">{t("Payment")}</h3>
            <div className="flex flex-wrap gap-2">
              {ctx.payment_modes.map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={cn("rounded-lg border px-4 py-2 text-sm", mode === m ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-zinc-300 bg-white hover:bg-zinc-50")}>
                  {t(m)}
                </button>
              ))}
            </div>
            <input className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
              placeholder={t("Reference (optional)")} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
          </section>
        )}
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </Sheet>
  )
}
