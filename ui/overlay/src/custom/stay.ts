/* Dates of a stay: check-out and nights always agree. Dates are plain YYYY-MM-DD and the
   sums use UTC midnight, so a time zone or a daylight change never moves a day. */

const DAY = 86_400_000

export const isISODate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

const at = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDaysISO(iso: string, days: number): string {
  return new Date(at(iso) + days * DAY).toISOString().slice(0, 10)
}

/** Nights between two dates; a stay is at least one night. */
export function nightsFromDates(checkIn: string, checkOut: string): number {
  if (!isISODate(checkIn) || !isISODate(checkOut)) return 1
  return Math.max(1, Math.round((at(checkOut) - at(checkIn)) / DAY))
}
