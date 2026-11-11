/* Arrival and departure time on an overnight booking. Both are optional: a blank
   time is not sent and the property's standard check-in and check-out time stands. */

export type StayTimes = { arrive: string; depart: string }

export const NO_TIMES: StayTimes = { arrive: "", depart: "" }

/** The hotel's usual times. The desk can change both. */
export const DEFAULT_TIMES: StayTimes = { arrive: "14:00", depart: "12:00" }

/** Arguments for Kamra's booking call. Kamra stores them as the planned check-in and check-out time. */
export function stayTimeArgs(t: StayTimes): { check_in_time?: string; check_out_time?: string } {
  return {
    ...(t.arrive ? { check_in_time: t.arrive } : {}),
    ...(t.depart ? { check_out_time: t.depart } : {}),
  }
}

/** "09:00" to "9:00 AM", for the booking summary. Blank stays blank. */
export function clock12(v: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  if (!m) return ""
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`
}
