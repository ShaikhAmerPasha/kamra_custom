import { showDate } from "./showDate"

/*  What an arrivals, in-house or departures row tells the desk before anyone opens it (Kamra Custom).
    Pure: the screen passes the row, the rooms and the clock. */

export interface DeskRow {
  status: string
  room: string | null
  check_out_date: string
  eta?: string | null
  special_requests?: string | null
  id_missing?: boolean
  vip?: number
  planned_check_in_time?: string | null
  planned_check_out_time?: string | null
  precheckin_status?: string | null
  missed?: boolean
  check_in_date?: string
}

export interface DeskRoom {
  name: string
  housekeeping_status: string
  occupancy_status: string
}

export type Tone = "rose" | "amber" | "green" | "zinc" | "indigo"
export interface Flag {
  key: string
  label: string
  tone: Tone
}

/** "Dirty", "Out of order", "Occupied" or "" when the room can take a guest. */
export function roomProblem(room: DeskRoom | undefined): string {
  if (!room) return ""
  if (room.housekeeping_status === "Out of Order") return "Out of order"
  if (room.occupancy_status === "Occupied") return "Occupied"
  if (room.housekeeping_status === "Dirty") return "Dirty"
  return ""
}

/** Past the planned check-out time on the day, or any earlier day. */
export function isOverdue(row: DeskRow, today: string, now: string): boolean {
  if (row.status !== "Checked In") return false
  if (row.check_out_date < today) return true
  return row.check_out_date === today && now > (row.planned_check_out_time || "12:00")
}

export function deskFlags(
  row: DeskRow,
  rooms: Record<string, DeskRoom>,
  tab: "arrivals" | "in-house" | "departures",
  today: string,
  now: string,
): Flag[] {
  const out: Flag[] = []
  if (isOverdue(row, today, now)) out.push({ key: "overdue", label: "Past check-out time", tone: "rose" })
  if (tab === "arrivals" && row.missed) out.push({ key: "missed", label: row.check_in_date ? `Arrival was ${showDate(row.check_in_date)}` : "Missed arrival", tone: "rose" })
  if (tab === "arrivals" && row.room) {
    const p = roomProblem(rooms[row.room])
    if (p) out.push({ key: "room", label: `Room ${p.toLowerCase()}`, tone: "amber" })
  }
  if (tab === "arrivals" && !row.room) out.push({ key: "noroom", label: "No room yet", tone: "zinc" })
  if (row.id_missing) out.push({ key: "id", label: "ID missing", tone: "amber" })
  if (tab === "arrivals" && row.precheckin_status === "Submitted") out.push({ key: "pre", label: "Online check-in sent", tone: "indigo" })
  if (tab === "arrivals" && row.precheckin_status === "Verified") out.push({ key: "pre", label: "Online check-in verified", tone: "green" })
  if (row.vip) out.push({ key: "vip", label: "VIP", tone: "amber" })
  if (row.special_requests && row.special_requests.trim()) out.push({ key: "req", label: "Has requests", tone: "zinc" })
  return out
}

/** The time to show for the row: planned arrival, else the guest's ETA, else the planned departure
    on the departures tab. */
export function timeLabel(row: DeskRow, tab: "arrivals" | "in-house" | "departures"): string {
  if (tab === "arrivals") return row.planned_check_in_time || row.eta || ""
  return row.planned_check_out_time || ""
}
