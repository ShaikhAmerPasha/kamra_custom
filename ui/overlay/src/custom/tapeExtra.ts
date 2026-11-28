/*  Tape chart extras (Kamra Custom): guests past their departure date and arrivals without a room.
    Kamra's chart draws only bookings that have a room and overlap the dates on screen, so both groups
    were invisible. These helpers add them to the data the chart already draws. */

export interface ExtraStay {
  name: string
  room?: string | null
  status: string
  check_in_date: string
  check_out_date: string
}

export interface ExtraRoom {
  name: string
  room_number: string
  room_type: string
  room_type_name?: string
  housekeeping_status: string
  bookings: ExtraStay[]
  blocks?: unknown[]
}

export interface ExtraData {
  start: string
  rooms: ExtraRoom[]
}

export interface Extras {
  today: string
  overdue: ExtraStay[]
  unassigned: ExtraStay[]
}

export const WAITING_TYPE = "__waiting"
export const WAITING_LABEL = "Waiting for a room"

export function addDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** What the bar covers on screen. An overdue guest has no dates left on the chart, so the bar sits on today and tomorrow, wide enough to read. */
export function barSpan(b: { check_in_date: string; check_out_date: string }): { inDate: string; outDate: string } {
  const v = b as { view_in?: string; view_out?: string } & typeof b
  return { inDate: v.view_in ?? b.check_in_date, outDate: v.view_out ?? b.check_out_date }
}

export const isOverdue = (b: object): boolean => (b as { overdue?: boolean }).overdue === true
export const isWaitingRow = (r: { room_type: string }): boolean => r.room_type === WAITING_TYPE

/** "25 Nov" from an ISO date. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

/** Days past the departure date, as words. */
export function overdueWords(checkOut: string, today: string): string {
  const n = Math.round((Date.parse(today) - Date.parse(checkOut)) / 86_400_000)
  return n <= 1 ? "1 day overdue" : `${n} days overdue`
}

/** Bars that overlap go on different lines. */
export function packLanes(stays: ExtraStay[]): ExtraStay[][] {
  const lanes: ExtraStay[][] = []
  const sorted = [...stays].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date) || a.name.localeCompare(b.name))
  for (const s of sorted) {
    const lane = lanes.find((l) => l[l.length - 1].check_out_date <= s.check_in_date)
    if (lane) lane.push(s)
    else lanes.push([s])
  }
  return lanes
}

/** The chart data with the overdue bars on their rooms and the waiting lines on top. Returns the data unchanged
    when there is nothing to add, so a quiet day looks exactly like Kamra's own chart. */
export function mergeExtras<T extends ExtraData>(data: T, extras: Extras | null | undefined, days: number): T {
  if (!extras) return data
  const end = addDay(data.start, days)
  const showOverdue = extras.today >= data.start && extras.today < end
  const overdue = showOverdue ? extras.overdue : []
  const lanes = packLanes(extras.unassigned)
  if (!overdue.length && !lanes.length) return data

  const rooms: ExtraRoom[] = data.rooms.map((r) => {
    const mine = overdue.filter((b) => b.room === r.name)
    if (!mine.length) return r
    const bars = mine.map((b) => ({
      ...b, overdue: true, view_in: extras.today, view_out: addDay(extras.today, 2),
    }))
    return { ...r, bookings: [...r.bookings, ...bars] }
  })
  const waiting: ExtraRoom[] = lanes.map((lane, i) => ({
    name: `__waiting_${i + 1}`,
    room_number: "—",
    room_type: WAITING_TYPE,
    room_type_name: WAITING_LABEL,
    housekeeping_status: "",
    blocks: [],
    bookings: lane.map((b) => ({ ...b, room: `__waiting_${i + 1}` })),
  }))
  return { ...data, rooms: [...waiting, ...rooms] } as unknown as T
}
