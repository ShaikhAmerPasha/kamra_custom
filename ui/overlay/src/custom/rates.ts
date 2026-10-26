// Agreed nightly rates: what the desk types, and what the server is sent.

export interface RoomRate {
  /** The desk agrees a rate that differs from the system rate. */
  agree: boolean
  /** One rate for every night, or a rate for each night. */
  perNight: boolean
  rate: string
  nightly: string[]
  /** An optional note beside the approver. */
  reason: string
  /** Who agreed the lower rate: MD Sir, GM Sir, Front Office ... */
  approver: string
}

export const emptyRate = (): RoomRate => ({ agree: false, perNight: false, rate: "", nightly: [], reason: "", approver: "" })

export function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const a = Date.parse(from + "T00:00:00Z")
  const b = Date.parse(to + "T00:00:00Z")
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s))

/** The agreed nightly rates, or undefined when the system rate stands or the entry is incomplete. */
export function agreedRates(r: RoomRate, nights: number): number[] | undefined {
  if (!r.agree || nights < 1) return undefined
  const rates = r.perNight
    ? Array.from({ length: nights }, (_, i) => num(r.nightly[i] ?? ""))
    : Array.from({ length: nights }, () => num(r.rate))
  return rates.every((x) => Number.isFinite(x) && x >= 0) ? rates : undefined
}

/** What is sent for one room: undefined when nothing was agreed. */
export function customRate(
  r: RoomRate,
  nights: number,
): { rates: number[]; reason: string; approver: string; all_in: boolean } | undefined {
  const rates = agreedRates(r, nights)
  // with a meal plan the agreed price covers the room and the meal; the server ignores all_in without one
  return rates ? { rates, reason: r.reason.trim(), approver: r.approver.trim(), all_in: true } : undefined
}

export interface PreviewInfo {
  discount_pct: number
  /** What the meal plan adds per night (0 for room only). */
  meal_per_night?: number
  needs_manager: boolean
  can_approve: boolean
  rule_error?: string
}

/** Why a room's rate cannot be booked yet, or "" when it can. */
export function rateProblem(r: RoomRate, nights: number, p: PreviewInfo | undefined): string {
  if (!r.agree) return ""
  if (!agreedRates(r, nights)) return r.perNight ? "Enter the rate for each night." : "Enter the rate."
  if (!p) return "Checking the rate."
  if (p.rule_error) return p.rule_error
  if (p.needs_manager && !p.can_approve) return "A manager must approve a discount this large."
  if (p.discount_pct > 0 && !r.approver.trim()) return "Choose who approved this rate."
  return ""
}
