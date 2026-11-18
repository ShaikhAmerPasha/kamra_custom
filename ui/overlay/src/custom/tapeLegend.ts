/*  Tape chart legend (Kamra Custom): each kind of bar with how many there are on the chart.
    A chip highlights its bars and dims the rest. "Owes money" is for guests in the house: a booking not yet paid is not an alarm. The kinds overlap: a stay can be both in
    house and owing money. */

export interface LegendBooking {
  name: string
  status: string
  check_in_date: string
  check_out_date: string
  due?: number
}

export type LegendKey = "in_house" | "reserved" | "arriving" | "leaving" | "owing" | "conflict"

export const LEGEND: { key: LegendKey; label: string; swatch: string }[] = [
  { key: "in_house", label: "In house", swatch: "bg-brand-600" },
  { key: "reserved", label: "Reserved", swatch: "bg-sky-500" },
  { key: "arriving", label: "Arriving today", swatch: "bg-sky-500 ring-2 ring-sky-200" },
  { key: "leaving", label: "Leaving today", swatch: "bg-brand-600 ring-2 ring-brand-200" },
  { key: "owing", label: "Owes money", swatch: "bg-rose-500" },
  { key: "conflict", label: "Changeover conflict", swatch: "bg-white ring-2 ring-rose-500" },
]

export function matches(key: LegendKey, b: LegendBooking, today: string, conflicts: Set<string>): boolean {
  switch (key) {
    case "in_house":
      return b.status === "Checked In"
    case "reserved":
      return b.status === "Confirmed"
    case "arriving":
      return b.status === "Confirmed" && b.check_in_date === today
    case "leaving":
      return b.status === "Checked In" && b.check_out_date === today
    case "owing":
      return b.status === "Checked In" && (b.due ?? 0) > 0
    case "conflict":
      return conflicts.has(b.name)
  }
}

/** One count per legend kind, over each stay once (a stay spans several days but is one bar). */
export function legendCounts(
  bookings: LegendBooking[],
  today: string,
  conflicts: Set<string>,
): Record<LegendKey, number> {
  const seen = new Map<string, LegendBooking>()
  for (const b of bookings) seen.set(b.name, b)
  const out = Object.fromEntries(LEGEND.map((l) => [l.key, 0])) as Record<LegendKey, number>
  for (const b of seen.values())
    for (const l of LEGEND) if (matches(l.key, b, today, conflicts)) out[l.key] += 1
  return out
}

/** Whole nights between two ISO dates, at least one. */
export function nightsOf(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z")
  const b = Date.parse(to + "T00:00:00Z")
  return Math.max(1, Math.round((b - a) / 86_400_000))
}
