/*  Group desk (Kamra Custom): which master fields can be sent down to the rooms of a group, how the
    ticked ones become one request, and how the answers of Kamra's group calls are told. Free of React. */

import { billingProblem, billingSave, EMPTY_BILLING, type Billing } from "./billing"

export interface SendForm extends Billing {
  market_segment: string
  special_requests: string
}
export const EMPTY_SEND: SendForm = { ...EMPTY_BILLING, market_segment: "", special_requests: "" }

/** The fields a master can send down, in the order of the form. */
export const SEND_FIELDS = [
  "pay_by", "gst_number", "pan_number", "credit_limit", "business_source", "domicile", "market_segment",
  "guaranteed", "tax_exempt", "special_guest", "special_requests",
] as const
export type SendField = (typeof SEND_FIELDS)[number]
export type Ticked = Partial<Record<SendField, boolean>>

/** The values to send: only the ticked fields, a cleared box clearing the field on the rooms. */
export function sendValues(ticked: Ticked, f: SendForm): Record<string, string | number> {
  const save = billingSave(f)
  const out: Record<string, string | number> = {}
  for (const k of SEND_FIELDS) {
    if (!ticked[k]) continue
    out[k] = k === "market_segment" ? f.market_segment : k === "special_requests" ? f.special_requests.trim() : save[k]
  }
  return out
}

/** The first thing wrong with the ticked fields, or "" when they can be sent. */
export function sendProblem(ticked: Ticked, f: SendForm): string {
  // only judge the fields that will be sent
  const probe: Billing = { ...EMPTY_BILLING }
  for (const k of ["gst_number", "pan_number", "credit_limit"] as const) if (ticked[k]) probe[k] = f[k]
  return billingProblem(probe)
}

export interface RoomResult {
  reservation: string
  error?: string
  assigned?: number
  unchanged?: number
  skipped?: string
  room_number?: string
  done?: number
}

/** One line per room for Kamra's group calls, which answer with {reservation, error | assigned | skipped ...}. */
export function roomLine(r: RoomResult): { ok: boolean; text: string } {
  if (r.error) return { ok: false, text: r.error }
  if (r.skipped) return { ok: false, text: r.skipped }
  if (r.unchanged) return { ok: true, text: "No change" }
  if (r.assigned) return { ok: true, text: r.room_number ? `Room ${r.room_number}` : "Room assigned" }
  return { ok: true, text: "Done" }
}

export function roomsTold(results: RoomResult[]): string {
  const bad = results.filter((r) => r.error || r.skipped).length
  return bad === 0 ? `All ${results.length} done.` : `${results.length - bad} done, ${bad} not done. See the reasons below.`
}

export interface PickupRow { room_type: string; room_type_name?: string; rooms_blocked: number; picked_up: number; remaining: number }

/** A block line as the desk reads it: "Deluxe: 10 blocked, 6 taken, 4 left". */
export const pickupLine = (p: PickupRow) => `${p.room_type_name || p.room_type}: ${p.rooms_blocked} blocked, ${p.picked_up} taken, ${p.remaining} left`

/** Rooms still open to act on (not cancelled, checked out or no-show). */
export const OPEN_STATUSES = ["Confirmed", "Held", "Pending Payment", "Checked In", "Waitlist"]
export const isOpen = (status: string) => OPEN_STATUSES.includes(status)
