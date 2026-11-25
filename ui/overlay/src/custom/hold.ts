/*  Hold and Copy on a booking (Kamra Custom): when a hold runs out, and what a copy of a booking
    starts from. Free of React. */

export const HOLD_CHOICES = [
  ["6", "6 hours"],
  ["24", "24 hours"],
  ["48", "48 hours"],
  ["arrival", "Until 6 pm on the arrival day"],
] as const

const pad = (n: number) => String(n).padStart(2, "0")
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`

/** The time a hold ends, as the server reads it. A choice of hours counts from now. "arrival" is 6 pm on
    the arrival day, or one hour from now when that time is already past (so a hold is never already over). */
export function holdUntil(now: Date, choice: string, arrival: string): string {
  if (choice === "arrival") {
    const [y, m, d] = arrival.split("-").map(Number)
    const end = new Date(y, (m || 1) - 1, d || 1, 18, 0, 0)
    return stamp(end > now ? end : new Date(now.getTime() + 3600_000))
  }
  const hours = Number(choice) > 0 ? Number(choice) : 24
  return stamp(new Date(now.getTime() + hours * 3600_000))
}

/** The extra arguments that make a booking a hold. */
export function holdArgs(now: Date, choice: string, arrival: string): { status: "Held"; hold_expires_on: string } {
  return { status: "Held", hold_expires_on: holdUntil(now, choice, arrival) }
}

export interface CopySource {
  guest: string | null
  guest_name: string
  phone: string | null
  room_type: string
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
}

const dayNumber = (s: string) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000)

/** What the booking dialog opens with for a copy: same guest, room type, party and length of stay.
    Dates that are already past move to today, because a booking cannot start before today. */
export function copyInitial(src: CopySource, today: string) {
  const nights = Math.max(1, dayNumber(src.check_out_date) - dayNumber(src.check_in_date))
  return {
    guest: src.guest ?? undefined,
    guest_name: src.guest_name,
    phone: src.phone ?? undefined,
    room_type: src.room_type,
    date: src.check_in_date < today ? today : src.check_in_date,
    stays: nights,
    adults: src.adults,
    children: src.children,
  }
}
