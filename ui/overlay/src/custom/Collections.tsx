/*  Money collected on the business date, by payment mode and by cashier (Kamra Custom), so a shift
    can be counted without running a report. Shows on the All tills screen. */

import { useEffect, useState } from "react"
import { call, getCurrentProperty } from "../lib/api"
import { cur } from "../lib/money"
import { useT } from "../lib/i18n"

interface Data {
  date: string
  total: number
  refunds: number
  cash: number
  by_mode: { mode: string; amount: number; lines: number }[]
  by_cashier: { cashier: string; amount: number; cash: number; lines: number }[]
}

const money = (n: number) => `${n < 0 ? "-" : ""}${cur()}${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export function Collections() {
  const { t } = useT()
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    call<Data>("kamra_custom.cashier.collections", { property: getCurrentProperty() })
      .then(setData)
      .catch(() => {})
  }, [])
  if (!data) return null
  const top = Math.max(1, ...data.by_mode.map((m) => Math.abs(m.amount)))
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">{t("Collected on the business date, by mode")}</h2>
          <span className="text-lg font-semibold tabular-nums">{money(data.total)}</span>
        </div>
        {data.by_mode.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{t("No payments on this business date yet.")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.by_mode.map((m) => (
              <div key={m.mode} className="grid grid-cols-[8.5rem_1fr_6rem] items-center gap-2 text-sm">
                <span className="truncate">{t(m.mode)}</span>
                <span className="h-3 rounded bg-zinc-100">
                  <span className="block h-3 rounded bg-brand-600" style={{ width: `${Math.max(2, (Math.abs(m.amount) / top) * 100)}%` }} />
                </span>
                <span className="text-end tabular-nums">{money(m.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {data.refunds !== 0 && <p className="mt-3 text-xs text-rose-600">{t("Refunds included: {amount}", { amount: money(data.refunds) })}</p>}
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">{t("By cashier")}</h2>
          <span className="text-xs text-zinc-500">{t("Cash in hand to count: {amount}", { amount: money(data.cash) })}</span>
        </div>
        {data.by_cashier.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{t("No payments on this business date yet.")}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-start text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="py-1 text-start font-semibold">{t("Cashier")}</th>
                <th className="py-1 text-end font-semibold">{t("Cash")}</th>
                <th className="py-1 text-end font-semibold">{t("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {data.by_cashier.map((c) => (
                <tr key={c.cashier} className="border-t border-zinc-100">
                  <td className="py-1.5">{c.cashier.split("@")[0]}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(c.cash)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
