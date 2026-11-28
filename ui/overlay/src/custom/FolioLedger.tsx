/*  The balance strip and the payment ledger on a Kamra bill (Kamra Custom). */

import { showMoment } from "./showDate"
import { useState } from "react"
import { cn } from "../lib/utils"
import { useT } from "../lib/i18n"
import { ledgerRows, sections, strip, type LedgerCharge, type LedgerGroup, type LedgerPayment } from "./folioLedger"

export function BalanceStrip(props: {
  charges: LedgerCharge[]
  paid: number
  balance: number
  guest: string
  detail: string
  status: string
  money: (n: number) => string
  /** Jumps to the payment form: the cashier's main action, which sits below the bill. */
  onTakePayment?: () => void
}) {
  const { t } = useT()
  const s = strip(props.charges, props.paid, props.balance)
  const label = s.tone === "advance" ? t("Advance held") : s.tone === "settled" ? t("Settled") : t("Balance due")
  return (
    <div
      className={cn(
        "sticky top-12 z-20 mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border px-4 py-3 print:hidden",
        s.tone === "owing" && "border-rose-200 bg-rose-50",
        s.tone === "settled" && "border-emerald-200 bg-emerald-50",
        s.tone === "advance" && "border-sky-200 bg-sky-50",
      )}
    >
      <div>
        <div className="text-xs font-medium text-zinc-600">{label}</div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            s.tone === "owing" && "text-rose-700",
            s.tone === "settled" && "text-emerald-700",
            s.tone === "advance" && "text-sky-700",
          )}
        >
          {props.money(Math.abs(s.balance))}
        </div>
      </div>
      <Stat k={t("Charges")} v={props.money(s.charges)} />
      {s.discount !== 0 && <Stat k={t("Discount")} v={props.money(s.discount)} />}
      <Stat k={t("Paid")} v={props.money(s.paid)} />
      {props.onTakePayment && (
        <button
          type="button"
          onClick={props.onTakePayment}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t("Take payment")}
        </button>
      )}
      <div className="ms-auto min-w-0 text-end text-sm">
        <div className="truncate font-semibold">{props.guest}</div>
        <div className="truncate text-xs text-zinc-600">
          {props.detail} · {t(props.status)}
        </div>
      </div>
    </div>
  )
}

function Stat(p: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-600">{p.k}</div>
      <div className="text-sm font-semibold tabular-nums">{p.v}</div>
    </div>
  )
}

const KIND_TONE: Record<string, string> = {
  Refund: "bg-rose-50 text-rose-600",
  "Security Deposit": "bg-violet-50 text-violet-700",
  Advance: "bg-sky-50 text-sky-700",
  Payment: "bg-emerald-50 text-emerald-700",
}

export function PaymentLedger(props: { payments: LedgerPayment[]; money: (n: number) => string }) {
  const { t } = useT()
  const [by, setBy] = useState<LedgerGroup>("time")
  const rows = ledgerRows(props.payments)
  const parts = sections(rows, by)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("Payments")}</h3>
        <span className="inline-flex rounded-lg border border-zinc-200 p-0.5 text-xs print:hidden" role="group" aria-label={t("Group payments")}>
          {(["time", "mode"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={by === g}
              onClick={() => setBy(g)}
              className={cn("rounded-md px-2.5 py-1 font-medium", by === g ? "bg-brand-50 text-brand-700" : "text-zinc-500 hover:text-zinc-700")}
            >
              {g === "time" ? t("In order") : t("By mode")}
            </button>
          ))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-start text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-1.5 pe-3 text-start font-semibold">{t("When")}</th>
              <th className="py-1.5 pe-3 text-start font-semibold">{t("Mode")}</th>
              <th className="py-1.5 pe-3 text-start font-semibold">{t("Reference")}</th>
              <th className="py-1.5 pe-3 text-start font-semibold">{t("Cashier")}</th>
              <th className="py-1.5 text-end font-semibold">{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((s) => (
              <PaymentSection key={s.label || "all"} label={s.label} total={s.total} rows={s.rows} money={props.money} show={by === "mode"} t={t} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-300 font-semibold">
              <td className="py-1.5" colSpan={4}>{t("Total paid")}</td>
              <td className="py-1.5 text-end tabular-nums">{props.money(rows.reduce((n, r) => n + r.amount, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function PaymentSection(p: {
  label: string
  total: number
  rows: ReturnType<typeof ledgerRows>
  money: (n: number) => string
  show: boolean
  t: (s: string) => string
}) {
  return (
    <>
      {p.show && (
        <tr className="bg-zinc-50">
          <td className="py-1 ps-1 text-xs font-semibold" colSpan={4}>
            {p.t(p.label)} · {p.rows.length}
          </td>
          <td className="py-1 text-end text-xs font-semibold tabular-nums">{p.money(p.total)}</td>
        </tr>
      )}
      {p.rows.map((r) => (
        <tr key={r.key} className="border-b border-zinc-100">
          <td className="py-1.5 pe-3 font-mono text-xs text-zinc-600">{showMoment(r.when)}</td>
          <td className="py-1.5 pe-3">
            {p.t(r.mode)}
            {r.kind !== "Payment" && (
              <span className={cn("ms-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold", KIND_TONE[r.kind] ?? KIND_TONE.Payment)}>{p.t(r.kind)}</span>
            )}
          </td>
          <td className="py-1.5 pe-3 font-mono text-xs text-zinc-600">{r.reference || "-"}</td>
          <td className="py-1.5 pe-3 text-zinc-600">{r.cashier || "-"}</td>
          <td className={cn("py-1.5 text-end tabular-nums", r.amount < 0 && "font-medium text-rose-600")}>{p.money(r.amount)}</td>
        </tr>
      ))}
    </>
  )
}
