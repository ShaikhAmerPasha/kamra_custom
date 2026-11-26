/*  The day-by-day rate editor on a booking (Kamra Custom): MyCloud's rate plan grid. The system price of
    each night sits beside the agreed price, one night's price can be copied to every night, and a
    discount is worked out from the system price by percent or by amount. Prices here are the ones the
    desk types: per night, room and meal together. Free of React. */

export interface SystemPreview {
  entry_rates?: number[]
  meal_per_night?: number
  /** The property writes rates with tax in them: then these are not the amounts the panel types. */
  inclusive?: boolean
}

/** The system price of each night in the way the panel is typed, or null when it cannot say. */
export function systemNightly(p: SystemPreview | undefined): number[] | null {
  if (!p || p.inclusive || !p.entry_rates || p.entry_rates.length === 0) return null
  const meal = p.meal_per_night ?? 0
  return p.entry_rates.map((r) => round2(r + meal))
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const asText = (rates: number[]) => rates.map((r) => String(round2(r)))

/** Every night at the system price less a percent. Under 0 or over 100 is not a discount. */
export function discountByPercent(system: number[], pct: number): string[] | null {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null
  return asText(system.map((s) => s * (1 - pct / 100)))
}

/** Every night at the system price less an amount a night, never below 0. */
export function discountByAmount(system: number[], amount: number): string[] | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  return asText(system.map((s) => Math.max(0, s - amount)))
}

/** The price of night i on every night. */
export function copyToAll(nightly: string[], i: number): string[] {
  return nightly.map(() => nightly[i] ?? "")
}

/** The price of night i on it and the nights after it. */
export function copyToFollowing(nightly: string[], i: number): string[] {
  return nightly.map((v, k) => (k >= i ? nightly[i] ?? "" : v))
}

/** Every night back at the system price. */
export function resetToSystem(system: number[]): string[] {
  return asText(system)
}

/** How far below the system price an agreed price is, in percent (0 when at or above it). */
export function percentBelow(system: number, agreed: number): number {
  if (!(system > 0) || !Number.isFinite(agreed) || agreed >= system) return 0
  return round2(((system - agreed) / system) * 100)
}

/** The amount typed, as a number, or NaN when it is blank or not a number. */
export const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s))
