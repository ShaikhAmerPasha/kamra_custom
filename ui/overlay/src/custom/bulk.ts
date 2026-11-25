/*  Bulk actions on the ticked rows of the reservation search (Kamra Custom): which action fits which
    rows, how the ticks work, and how the answer is told to the desk. Free of React. */

export const BULK_ACTIONS = [
  ["assign_rooms", "Assign rooms"],
  ["verify_precheckin", "Pre-check-in validation"],
  ["check_in", "Check-in"],
] as const
export type BulkAction = (typeof BULK_ACTIONS)[number][0]

export interface BulkRow { name: string; status: string }
export interface BulkResult { reservation: string; guest_name: string; ok: boolean; message: string }
export interface BulkAnswer { results: BulkResult[]; done: number; failed: number }

export const MAX_TICKED = 100

/** Tick or untick one row. */
export function toggle(ticked: string[], name: string): string[] {
  return ticked.includes(name) ? ticked.filter((n) => n !== name) : [...ticked, name]
}

/** The select-all box: ticks every row shown (up to the limit), or clears them when all are ticked. */
export function toggleAll(ticked: string[], shown: string[]): string[] {
  const all = shown.slice(0, MAX_TICKED)
  return all.length > 0 && all.every((n) => ticked.includes(n)) ? [] : all
}

/** Only rows still on the page stay ticked after a new search. */
export const keepShown = (ticked: string[], shown: string[]) => ticked.filter((n) => shown.includes(n))

/** The checkbox state of the header: none, some or all. */
export function headState(ticked: string[], shown: string[]): "none" | "some" | "all" {
  const n = shown.filter((s) => ticked.includes(s)).length
  return n === 0 ? "none" : n === shown.length ? "all" : "some"
}

/** One line for the desk after an action. */
export function summary(a: BulkAnswer, action: BulkAction): string {
  const label = BULK_ACTIONS.find(([k]) => k === action)?.[1] ?? action
  if (a.failed === 0) return `${label}: all ${a.done} done.`
  if (a.done === 0) return `${label}: none done. See the reasons below.`
  return `${label}: ${a.done} done, ${a.failed} not done. See the reasons below.`
}

/** The page that prints the registration cards of these bookings together. */
export const cardsPath = (names: string[]) => `/reservation-search/cards?ids=${encodeURIComponent(names.join(","))}`

/** The bookings named in that page's address, in order, without blanks or repeats. */
export function idsFromQuery(query: string): string[] {
  const raw = new URLSearchParams(query).get("ids") ?? ""
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_TICKED)
}
