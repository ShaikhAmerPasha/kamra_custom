/*  The tape chart's legend and hover card (Kamra Custom). */

import { cn } from "../lib/utils"
import { useT } from "../lib/i18n"
import { LEGEND, legendCounts, nightsOf, type LegendBooking, type LegendKey } from "./tapeLegend"

export function TapeLegend(props: {
  bookings: LegendBooking[]
  today: string
  conflicts: Set<string>
  active: LegendKey | null
  onPick: (k: LegendKey | null) => void
}) {
  const { t } = useT()
  const counts = legendCounts(props.bookings, props.today, props.conflicts)
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" role="group" aria-label={t("Legend")}>
      {LEGEND.map((l) => {
        const on = props.active === l.key
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={on}
            disabled={counts[l.key] === 0}
            onClick={() => props.onPick(on ? null : l.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition",
              on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              counts[l.key] === 0 && "opacity-40",
            )}
          >
            <span className={cn("size-3 rounded-sm", l.swatch)} aria-hidden />
            {t(l.label)}
            <span className="tabular-nums text-zinc-900">{counts[l.key]}</span>
          </button>
        )
      })}
      {props.active && (
        <button type="button" className="text-zinc-500 underline" onClick={() => props.onPick(null)}>
          {t("Clear")}
        </button>
      )}
    </div>
  )
}

export interface CardBooking extends LegendBooking {
  guest_name: string
  room?: string
  adults?: number
  children?: number
  meal_plan?: string
  source?: string
  company?: string | null
  planned_check_in_time?: string | null
  planned_check_out_time?: string | null
  paid?: number
  due?: number
}

export function BookingCard(props: { b: CardBooking; x: number; y: number; money: (n: number) => string }) {
  const { t } = useT()
  const { b } = props
  const hhmm = (v?: string | null) => (v ? String(v).slice(0, 5) : "")
  const left = Math.min(props.x + 12, window.innerWidth - 270)
  const top = Math.min(props.y + 14, window.innerHeight - 230)
  const nights = nightsOf(b.check_in_date, b.check_out_date)
  const guests = `${b.adults ?? 0} ${t(b.adults === 1 ? "adult" : "adults")}${b.children ? ` + ${b.children} ${t(b.children === 1 ? "child" : "children")}` : ""}`
  return (
    <div
      role="tooltip"
      style={{ left, top }}
      className="pointer-events-none fixed z-50 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{b.guest_name}</span>
        <span className="shrink-0 text-zinc-500">{t(b.status)}</span>
      </div>
      <dl className="mt-2 space-y-1">
        <Row k={t("Stay")} v={`${b.check_in_date}${hhmm(b.planned_check_in_time) ? " " + hhmm(b.planned_check_in_time) : ""} → ${b.check_out_date}${hhmm(b.planned_check_out_time) ? " " + hhmm(b.planned_check_out_time) : ""} · ${nights} ${t(nights === 1 ? "night" : "nights")}`} />
        <Row k={t("Guests")} v={guests} />
        {b.meal_plan ? <Row k={t("Meal plan")} v={b.meal_plan} /> : null}
        {b.company ? <Row k={t("Company")} v={b.company} /> : b.source ? <Row k={t("Source")} v={b.source} /> : null}
        <Row k={t("Paid")} v={props.money(b.paid ?? 0)} />
        <Row k={t("Balance due")} v={props.money(b.due ?? 0)} tone={(b.due ?? 0) > 0 ? "text-rose-600 font-semibold" : ""} />
      </dl>
      <div className="mt-2 text-zinc-400">{b.name}</div>
    </div>
  )
}

function Row(p: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{p.k}</dt>
      <dd className={cn("text-end tabular-nums", p.tone)}>{p.v}</dd>
    </div>
  )
}
