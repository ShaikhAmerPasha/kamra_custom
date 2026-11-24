/*  House today (Kamra Custom): the manager's one screen. The day's numbers, the rooms, what needs
    attention, what was collected and what is owed, and the Today / month / year table, with each
    number a link to the records behind it. The business date is stated at the top, because it is the
    date every figure is for. */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { call, getCurrentProperty } from "../lib/api"
import { useT } from "../lib/i18n"
import { cur } from "../lib/money"
import { cn } from "../lib/utils"
import { showDate } from "./showDate"
import { attentionLink, behindNotice, changeText, changeTone, formatCell, PERIOD_LABELS, periodRows, roomLines, type Period, type RoomsBlock } from "./houseHub"

interface Movement {
  arrivals: number
  departures: number
  in_house: number
  no_shows: number
}

interface House {
  business_date: string
  calendar_date: string
  days_behind: number
  total_rooms: number
  periods: Record<string, Period>
  movement: { today: Movement; tomorrow: Movement }
  rooms: RoomsBlock
  guests: { adults: number; children: number; complimentary: number }
  attention: { total: number; groups: { key: string; label: string; count: number }[] }
  collected: { total: number; refunds: number; by_mode: { mode: string; amount: number }[]; by_card_network?: { network: string; amount: number }[] }
  owed: { guests: number; open_bills: number; companies: number; overdue: number }
}

const money = (n: number) => `${cur()}${Math.round(n).toLocaleString("en-IN")}`

function Card(props: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-zinc-200 bg-white px-4 py-3", props.className)}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{props.title}</h2>
      {props.children}
    </section>
  )
}

function Line(props: { label: string; value: React.ReactNode; to?: string; tone?: string }) {
  const body = (
    <>
      <span className="text-zinc-700">{props.label}</span>
      <span className={cn("font-medium tabular-nums", props.tone, props.to && "underline decoration-zinc-300 underline-offset-2")}>{props.value}</span>
    </>
  )
  const cls = "flex items-center justify-between gap-3 py-1 text-sm"
  return props.to ? (
    <Link to={props.to} className={cn(cls, "rounded hover:bg-zinc-50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Headline(props: { label: string; value: string; note: string; tone?: string; to?: string }) {
  const inner = (
    <>
      <div className="text-xs text-zinc-500">{props.label}</div>
      <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", props.tone)}>{props.value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{props.note}</div>
    </>
  )
  const cls = "block rounded-xl border border-zinc-200 bg-white px-4 py-3"
  return props.to ? <Link to={props.to} className={cn(cls, "hover:bg-zinc-50")}>{inner}</Link> : <div className={cls}>{inner}</div>
}

export default function HouseHub() {
  const { t } = useT()
  const [data, setData] = useState<House | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let live = true
    setData(null)
    call<House>("kamra_custom.house.house_today", { property: getCurrentProperty() })
      .then((d) => live && setData(d))
      .catch(() => live && setError(t("The house figures could not be loaded. Try again in a moment.")))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) return <p className="py-10 text-center text-sm text-zinc-500">{error || t("Loading…")}</p>

  const today = data.periods.today?.this
  const behind = behindNotice(data.days_behind)
  const rows = periodRows(data.periods)
  const mv = data.movement.today
  const next = data.movement.tomorrow
  const owedTotal = data.owed.guests + data.owed.companies

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("House today")}</h1>
        <p className="text-sm text-zinc-500">
          {t("Business date {date}. Every figure opens the records behind it.", { date: showDate(data.business_date) })}
        </p>
      </header>

      {behind && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t(behind.key, behind.vars)}{" "}
          <Link to="/end-of-day" className="underline">{t("Open the night audit")}</Link>
        </p>
      )}

      <p className="text-xs text-zinc-500">
        {t("Revenue, occupancy, movement, collections and the table are for the business date. Rooms, attention and money owed are live, as of now.")}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Headline label={t("Occupancy")} value={`${today?.occupancy_pct ?? 0}%`} note={t("{n} of {total} rooms sold", { n: today?.rooms_sold ?? 0, total: data.total_rooms })} to="/in-house?tab=in-house" />
        <Headline label={t("ADR")} value={money(today?.adr ?? 0)} note={t("average room rate sold")} />
        <Headline label={t("RevPAR")} value={money(today?.revpar ?? 0)} note={t("room revenue per room")} />
        <Headline label={t("Revenue")} value={money(today?.total_revenue ?? 0)} note={t("all departments")} to="/reports/flash" />
        <Headline label={t("Collected")} value={money(data.collected.total)} note={t("all modes, business date")} to="/cashier/shift-report" />
        <Headline label={t("Owed")} value={money(owedTotal)} note={t("guests and companies, now")} tone={owedTotal > 0 ? "text-rose-700" : undefined} to="/billing" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title={t("Movement on the business date")}>
          <Line label={t("Arrivals today")} value={mv.arrivals} to="/in-house?tab=arrivals" />
          <Line label={t("Departures today")} value={mv.departures} to="/in-house?tab=departures" />
          <Line label={t("In house")} value={mv.in_house} to="/in-house?tab=in-house" />
          <Line label={t("Guests in house now")} value={`${data.guests.adults} ${t("adults")}${data.guests.children ? ` + ${data.guests.children} ${t("children")}` : ""}`} />
          {data.guests.complimentary > 0 && <Line label={t("Complimentary stays in house")} value={data.guests.complimentary} />}
          <Line label={t("No-shows")} value={mv.no_shows} />
          <Line label={t("Tomorrow: arrivals / departures")} value={`${next.arrivals} / ${next.departures}`} />
        </Card>
        <Card title={t("Rooms")}>
          {roomLines(data.rooms).map((l) => (
            <Line
              key={l.key}
              label={t(l.label)}
              value={l.count}
              tone={l.count > 0 && l.tone === "bad" ? "text-rose-700" : l.count > 0 && l.tone === "warn" ? "text-amber-700" : undefined}
              to={l.key === "clean" || l.key === "inspected" ? undefined : "/housekeeping-board"}
            />
          ))}
          <Line label={t("Total rooms")} value={data.rooms.total} />
        </Card>
        <Card title={t("Needs attention")}>
          {data.attention.groups.length === 0 ? (
            <p className="py-1 text-sm text-emerald-700">{t("Nothing needs a look right now.")}</p>
          ) : (
            data.attention.groups.map((g) => (
              <Line key={g.key} label={t(g.label)} value={g.count} to={attentionLink(g.key)} tone={g.key === "overdue" || g.key === "owing" ? "text-rose-700" : "text-amber-700"} />
            ))
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card title={t("Today, this month, this year")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="py-1 pr-3 text-left font-medium" />
                  {(["today", "mtd", "ytd"] as const).map((id) => (
                    <th key={id} className="px-2 py-1 text-right font-medium">
                      {t(PERIOD_LABELS[id])}
                      {data.periods[id] && <div className="font-normal text-zinc-400">{showDate(data.periods[id].from)}{data.periods[id].from !== data.periods[id].to ? ` – ${showDate(data.periods[id].to)}` : ""}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.key} className={cn(r.key === "total_revenue" && "font-semibold")}>
                    <td className="py-1.5 pr-3 text-zinc-700">{t(r.label)}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                        {formatCell(r.kind, c.value, money)}
                        {changeText(c.change) && <div className={cn("text-xs font-normal", changeTone(c.change))}>{changeText(c.change)}</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {t("Small figures under each number: change against the same dates last year. Year to date starts at the financial year.")}{" "}
            <Link to="/dashboard" className="underline">{t("Open the Revenue dashboard")}</Link>
          </p>
        </Card>

        <div className="space-y-3">
          <Card title={t("Collected on the business date, by mode")}>
            {data.collected.by_mode.length === 0 ? (
              <p className="py-1 text-sm text-zinc-500">{t("Nothing collected yet.")}</p>
            ) : (
              data.collected.by_mode.map((m) => (
                <div key={m.mode}>
                  <Line label={m.mode} value={money(m.amount)} />
                  {m.mode === "Card" && (data.collected.by_card_network?.length ?? 0) > 0 && (
                    <div className="mb-1 ml-3 border-l border-zinc-200 pl-3">
                      {data.collected.by_card_network!.map((c) => (
                        <div key={c.network} className="flex items-center justify-between gap-3 py-0.5 text-xs text-zinc-500">
                          <span>{c.network === "Not recorded" ? t("Card type not recorded") : c.network}</span>
                          <span className="tabular-nums">{money(c.amount)}</span>
                        </div>
                      ))}
                      <p className="pt-0.5 text-[11px] text-zinc-400">{t("Card types include restaurant bills paid at the outlet.")}</p>
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="mt-1 border-t border-zinc-100 pt-1">
              <Line label={t("Total")} value={money(data.collected.total)} to="/cashier/shift-report" />
            </div>
          </Card>
          <Card title={t("Owed, as of now")}>
            <Line label={t("Guest bills ({n} open)", { n: data.owed.open_bills })} value={money(data.owed.guests)} to="/billing" />
            <Line label={t("Company accounts")} value={money(data.owed.companies)} to="/receivables" />
            {data.owed.overdue > 0 && <Line label={t("Overdue")} value={money(data.owed.overdue)} tone="text-rose-700" to="/receivables" />}
          </Card>
        </div>
      </div>
    </div>
  )
}
