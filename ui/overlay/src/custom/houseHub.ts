/*  The House hub (Kamra Custom): the manager's one screen. Pure rules for what the screen shows. */

export interface PeriodFigures {
  rooms_sold: number
  occupancy_pct: number
  room_revenue: number
  total_revenue: number
  adr: number
  revpar: number
}

export interface Period {
  from: string
  to: string
  this: PeriodFigures
  last: PeriodFigures
  change_pct: Record<keyof PeriodFigures, number | null>
}

export type CellKind = "count" | "pct" | "money"

export interface TableRow {
  key: string
  label: string
  kind: CellKind
  /** one entry per period (today, month, year): the figure, and the change against last year */
  cells: { value: number; change: number | null }[]
}

const ORDER = ["today", "mtd", "ytd"] as const
export const PERIOD_LABELS: Record<(typeof ORDER)[number], string> = { today: "Today", mtd: "Month to date", ytd: "Year to date" }

/** Other revenue is what is not rooms: food, extras, everything else. */
const otherRevenue = (f: PeriodFigures) => Math.max(0, f.total_revenue - f.room_revenue)

/** The rows of the Today / month / year table. */
export function periodRows(periods: Record<string, Period>): TableRow[] {
  const get = (id: (typeof ORDER)[number]) => periods[id]
  const pct = (a: number, b: number) => (b ? Math.round((1000 * (a - b)) / b) / 10 : null)
  const row = (key: string, label: string, kind: CellKind, pick: (f: PeriodFigures) => number, change?: keyof PeriodFigures): TableRow => ({
    key, label, kind,
    cells: ORDER.map((id) => {
      const p = get(id)
      if (!p) return { value: 0, change: null }
      return { value: pick(p.this), change: change ? p.change_pct[change] : pct(pick(p.this), pick(p.last)) }
    }),
  })
  return [
    row("rooms_sold", "Rooms sold", "count", (f) => f.rooms_sold, "rooms_sold"),
    row("occupancy", "Occupancy", "pct", (f) => f.occupancy_pct, "occupancy_pct"),
    row("room_revenue", "Room revenue", "money", (f) => f.room_revenue, "room_revenue"),
    row("other_revenue", "Food and other revenue", "money", otherRevenue),
    row("total_revenue", "Total revenue", "money", (f) => f.total_revenue, "total_revenue"),
    row("adr", "ADR (average room rate sold)", "money", (f) => f.adr, "adr"),
    row("revpar", "RevPAR (room revenue per room)", "money", (f) => f.revpar, "revpar"),
  ]
}

/** "+12%", "-3.5%", or "" when there is no figure from last year to compare with. */
export function changeText(change: number | null | undefined): string {
  if (change === null || change === undefined || Number.isNaN(change)) return ""
  const s = Math.abs(change) >= 100 ? Math.round(change) : change
  return `${change > 0 ? "+" : ""}${s}%`
}

export const changeTone = (change: number | null | undefined) =>
  change === null || change === undefined || change === 0 ? "text-zinc-500" : change > 0 ? "text-emerald-700" : "text-rose-700"

export function formatCell(kind: CellKind, value: number, money: (n: number) => string): string {
  if (kind === "money") return money(value)
  if (kind === "pct") return `${Math.round(value * 10) / 10}%`
  return Math.round(value).toLocaleString("en-IN")
}

/** The notice when the business date has not caught up with the calendar. */
export function behindNotice(daysBehind: number): { key: string; vars: { n: number } } | null {
  if (daysBehind <= 0) return null
  return { key: daysBehind === 1 ? "The night audit is {n} day behind. These figures are for the business date shown, not today's calendar date." : "The night audit is {n} days behind. These figures are for the business date shown, not today's calendar date.", vars: { n: daysBehind } }
}

/** Where a Needs attention group takes the manager. */
export function attentionLink(key: string): string {
  switch (key) {
    case "audit_behind":
      return "/end-of-day"
    case "not_ready":
    case "no_room":
    case "no_show":
      return "/in-house?tab=arrivals"
    default:
      return "/in-house?tab=in-house"
  }
}

export interface RoomsBlock {
  total: number
  clean: number
  dirty: number
  inspected: number
  out_of_order: number
}

/** The rooms that need housekeeping or maintenance, for the Rooms card: worst first. */
export function roomLines(r: RoomsBlock): { key: string; label: string; count: number; tone: "bad" | "warn" | "plain" }[] {
  return [
    { key: "out_of_order", label: "Out of order", count: r.out_of_order, tone: "bad" as const },
    { key: "dirty", label: "Dirty", count: r.dirty, tone: "warn" as const },
    { key: "clean", label: "Clean", count: r.clean, tone: "plain" as const },
    { key: "inspected", label: "Inspected", count: r.inspected, tone: "plain" as const },
  ]
}
