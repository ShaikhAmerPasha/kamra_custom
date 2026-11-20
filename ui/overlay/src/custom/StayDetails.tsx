/*  Stay details for the check-in and check-out panels (Kamra Custom). Nothing is shown until the desk
    asks: a row of buttons, and each opens only its own details. A dot on a button means something
    there needs a look (a deposit still due, or notes to read). The links open the registration card
    and the bill. */

import { useState } from "react"
import { useT } from "../lib/i18n"
import { cur } from "../lib/money"
import { toFullPath } from "../lib/routing"
import { cn } from "../lib/utils"
import { detailRows, sections, statusBanner, type BannerTone, type DetailInput, type SectionKey } from "./stayDetails"
import { showDate } from "./showDate"

const BANNER: Record<BannerTone, string> = {
  blue: "bg-blue-100 text-blue-800",
  green: "bg-emerald-100 text-emerald-800",
  grey: "bg-zinc-200 text-zinc-700",
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-800",
}

const money = (n: number) => `${cur()}${Math.round(n).toLocaleString("en-IN")}`

export function StayDetails(props: { detail: DetailInput & { folio_name?: string | null } }) {
  const { t } = useT()
  const d = props.detail
  const [open, setOpen] = useState<SectionKey | null>(null)
  const banner = statusBanner((d as { status?: string }).status)
  const parts = sections(detailRows(d, { money, day: (iso) => showDate(iso) }))
  const shown = parts.find((p) => p.key === open)
  const btn = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
  const link = `${btn} border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`
  return (
    <div className="space-y-2" aria-label={t("Stay details")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold tracking-wide", BANNER[banner.tone])}>{t(banner.label)}</span>
        <span className="text-xs text-zinc-500">{d.name}</span>
        <div className="ms-auto flex flex-wrap gap-2">
          {d.folio_name && (
            <a className={link} href={toFullPath(`/billing/${encodeURIComponent(d.folio_name)}`)} target="_blank" rel="noreferrer">
              {t("Take payment")}
            </a>
          )}
          <a className={link} href={toFullPath(`/grc/${encodeURIComponent(d.name)}`)} target="_blank" rel="noreferrer">
            {t("Registration card")}
          </a>
          <a className={link} href={toFullPath(`/grc/${encodeURIComponent(d.name)}`)} target="_blank" rel="noreferrer">
            {t("Change room")}
          </a>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-expanded={open === p.key}
            onClick={() => setOpen(open === p.key ? null : p.key)}
            className={cn(
              btn,
              open === p.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {t(p.label)}
            {p.alert && <span className="size-2 rounded-full bg-amber-500" aria-label={t("Needs a look")} />}
          </button>
        ))}
        {d.folio_name && (
          <a className={link} href={toFullPath(`/billing/${encodeURIComponent(d.folio_name)}`)} target="_blank" rel="noreferrer">
            {t("Bill, discounts and splits")}
          </a>
        )}
        <a className={link} href={toFullPath(`/activity?record=${encodeURIComponent(d.name)}`)} target="_blank" rel="noreferrer">
          {t("History")}
        </a>
      </div>
      {shown && (
        <dl className="grid gap-x-6 gap-y-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm sm:grid-cols-[8rem_1fr]">
          {shown.rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-zinc-500">{t(r.label)}</dt>
              <dd className={cn("min-w-0 break-words", r.tone === "warn" && "font-medium text-amber-700", r.tone === "ok" && "text-emerald-700")}>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
