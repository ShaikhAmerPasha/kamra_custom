/*  Plain logic of the reservation search screen (Kamra Custom): the status choices, the shortcuts,
    and how the typed filters become one call. Kept free of React so it can be tested alone. */

export const SEARCH_STATUSES = [
  ["reserved", "Reserved"],
  ["hold", "Hold"],
  ["in_house", "In-house"],
  ["checked_out", "Checked-out"],
  ["cancelled", "Cancelled"],
  ["no_show", "No-Show"],
  ["waitlisted", "Waitlisted"],
  ["all", "All"],
] as const

export const SEARCH_SHORTCUTS = [
  ["multi_room", "Groups / multiple room reservations"],
  ["arrivals_today", "Expected arrivals (today)"],
  ["arrivals_3_days", "Expected arrivals (next 3 days)"],
  ["no_shows_3_days", "No-shows (last 3 days)"],
] as const

export const SEARCH_SORTS = [
  ["name", "Name"],
  ["arrival", "Arrival"],
  ["departure", "Departure"],
  ["room", "Room"],
  ["status", "Status"],
  ["reservation", "Reservation #"],
  ["created", "Booked on"],
] as const

export interface SearchFilters {
  status: string
  name: string
  date: string
  date_in: "arrival" | "departure"
  phone: string
  market_segment: string
  reservation: string
  room: string
  group_name: string
  room_type: string
  include_accompanying: boolean
  shortcut: string
  sort_by: string
  descending: boolean
}

export const EMPTY_FILTERS: SearchFilters = {
  status: "reserved",
  name: "",
  date: "",
  date_in: "arrival",
  phone: "",
  market_segment: "",
  reservation: "",
  room: "",
  group_name: "",
  room_type: "",
  include_accompanying: false,
  shortcut: "",
  sort_by: "name",
  descending: false,
}

/** The arguments for kamra_custom.reservations.search: blanks are left out. */
export function searchArgs(property: string, f: SearchFilters): Record<string, string | number> {
  const out: Record<string, string | number> = { property, status: f.status, sort_by: f.sort_by, descending: f.descending ? 1 : 0 }
  const text: (keyof SearchFilters)[] = ["name", "date", "phone", "market_segment", "reservation", "room", "group_name", "room_type"]
  for (const k of text) {
    const v = String(f[k] ?? "").trim()
    if (v) out[k] = v
  }
  if (f.date) out.date_in = f.date_in
  if (f.include_accompanying) out.include_accompanying = 1
  if (f.shortcut) out.shortcut = f.shortcut
  return out
}

/** A shortcut sets its own status, so the radio follows it; choosing a radio drops the shortcut. */
export function withShortcut(f: SearchFilters, shortcut: string): SearchFilters {
  const status = shortcut === "no_shows_3_days" ? "no_show" : shortcut === "multi_room" ? "all" : shortcut ? "reserved" : f.status
  return { ...f, shortcut, status }
}

export function withStatus(f: SearchFilters, status: string): SearchFilters {
  return { ...f, status, shortcut: "" }
}

/** MyCloud asks for 3 letters first: a name search shorter than that can be slow. */
export function nameIsShort(f: SearchFilters): boolean {
  const n = f.name.trim()
  return n.length > 0 && n.length < 3
}

/** The three small marks beside a guest: group leader, repeat guest, travelling with others. */
export function marks(r: { is_leader?: boolean; repeater?: boolean; travels_with_others?: boolean; group_booking?: string | null }): string[] {
  const out: string[] = []
  if (r.is_leader) out.push("leader")
  else if (r.group_booking) out.push("group")
  if (r.repeater) out.push("repeater")
  if (r.travels_with_others) out.push("others")
  return out
}

export const STATUS_SHORT: Record<string, string> = {
  Confirmed: "CF",
  "Pending Payment": "PP",
  Requested: "RQ",
  Held: "HD",
  "Checked In": "IH",
  "Checked Out": "CO",
  Cancelled: "CL",
  "No Show": "NS",
  Waitlist: "WL",
}
