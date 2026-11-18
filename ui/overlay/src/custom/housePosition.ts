/*  House position (Kamra Custom): the rooms and the day's movement in one glance.
    Reads the figures Kamra's property dashboard already returns. A role that may not see
    money gets the same rows, because none of them is a money figure. */

export interface DashboardSlice {
  arrivals?: number
  departures?: number
  in_house?: number
  no_shows?: number
  housekeeping?: {
    room_status?: Record<string, number>
    occupied?: number
  }
  occupancy_now?: { occupied?: number; sellable?: number; occupancy_pct?: number }
}

export interface HousePosition {
  occupied: number
  sellable: number
  pct: number
  rooms: { label: string; count: number; tone: "ok" | "warn" | "bad" | "plain" }[]
  today: { label: string; count: number }[]
}

const n = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0)

export function housePosition(d: DashboardSlice | null | undefined): HousePosition {
  const status = d?.housekeeping?.room_status ?? {}
  const occupied = n(d?.occupancy_now?.occupied ?? d?.housekeeping?.occupied)
  const sellable = n(d?.occupancy_now?.sellable)
  const pct = sellable ? Math.round((1000 * occupied) / sellable) / 10 : 0
  return {
    occupied,
    sellable,
    pct,
    rooms: [
      { label: "Occupied", count: occupied, tone: "plain" },
      { label: "Clean", count: n(status["Clean"]), tone: "ok" },
      { label: "Inspected", count: n(status["Inspected"]), tone: "ok" },
      { label: "Dirty", count: n(status["Dirty"]), tone: "warn" },
      { label: "Out of order", count: n(status["Out of Order"]), tone: "bad" },
    ],
    today: [
      { label: "Arrivals", count: n(d?.arrivals) },
      { label: "In house", count: n(d?.in_house) },
      { label: "Departures", count: n(d?.departures) },
      { label: "No shows", count: n(d?.no_shows) },
    ],
  }
}
