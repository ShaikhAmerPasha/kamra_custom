/*  Extras for Kamra's booking dialog (Kamra Custom): internal remarks, and an
    agreed rate for each room. The dialog keeps its own flow; it asks this module
    for what to add to the booking it already sends. */

import { useEffect, useState } from "react"
import { call, getCurrentProperty, type GuestHit } from "../lib/api"
import { fmtMoney } from "../lib/money"
import { agreedRates, customRate, emptyRate, nightsBetween, rateProblem, type PreviewInfo, type RoomRate } from "./rates"

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

/** The guest typeahead, by name or mobile number (kamra_custom.guests.search). */
export const customGuestSearch = (q: string) =>
  call<GuestHit[]>("kamra_custom.guests.search", { q, property: getCurrentProperty() })

export interface BookingRoom {
  room_type: string
  adults: number
  children: number
  meal_plan: string
}

interface Preview extends PreviewInfo {
  system: { amount_after_tax: number }
  negotiated: { amount_after_tax: number } | null
  limit_pct: number
  entry_rates: number[]
  inclusive: boolean
}

export interface CustomBooking {
  remarks: string
  setRemarks: (v: string) => void
  rates: Record<number, RoomRate>
  setRate: (i: number, patch: Partial<RoomRate>) => void
  previews: Record<number, Preview | string>
  setPreviews: (f: (p: Record<number, Preview | string>) => Record<number, Preview | string>) => void
  nights: number
  setNights: (n: number) => void
  /** Something is wrong with an agreed rate, so the booking must wait. */
  blocked: boolean
  /** Agreed rates, in money: what the rooms cost more or less than the system rate (with tax). */
  adjust: number
  setRoomCount: (n: number) => void
  /** Extra arguments for the booking call of a single room. */
  single: () => Record<string, unknown>
  /** The agreed rate of room i, for a multi-room booking. */
  rateFor: (i: number) => { rates: number[]; reason: string } | undefined
  /** Extra arguments for a multi-room booking. */
  group: () => Record<string, unknown>
}

export function useCustomBooking(): CustomBooking {
  const [remarks, setRemarks] = useState("")
  const [rates, setRates] = useState<Record<number, RoomRate>>({})
  const [previews, setPreviews] = useState<Record<number, Preview | string>>({})
  const [nights, setNights] = useState(0)
  const [roomCount, setRoomCount] = useState(1)

  const rate = (i: number) => rates[i] ?? emptyRate()
  const live = Array.from({ length: roomCount }, (_, i) => i)
  const blocked = live.some((i) => {
    const p = previews[i]
    return rateProblem(rate(i), nights, typeof p === "object" ? p : undefined) !== ""
  })

  const adjust = live.reduce((sum, i) => {
    const p = previews[i]
    return typeof p === "object" && p.negotiated ? sum + (p.negotiated.amount_after_tax - p.system.amount_after_tax) : sum
  }, 0)

  return {
    remarks, setRemarks, rates, previews, setPreviews, nights, setNights, blocked, adjust, setRoomCount,
    setRate: (i, patch) => setRates((all) => ({ ...all, [i]: { ...(all[i] ?? emptyRate()), ...patch } })),
    single: () => {
      const r = customRate(rate(0), nights)
      return { internal_remarks: remarks.trim() || undefined, custom_rate: r }
    },
    rateFor: (i) => customRate(rate(i), nights),
    group: () => ({ internal_remarks: remarks.trim() || undefined }),
  }
}

const rule = (e: unknown): string => {
  try {
    const body = JSON.parse((e as { body?: string }).body ?? "")
    const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
    return msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "")
  } catch {
    return ""
  }
}

/** Internal remarks, and an agreed rate for each room of the booking. */
export function CustomBookingFields(props: {
  custom: CustomBooking
  rooms: BookingRoom[]
  checkIn: string
  checkOut: string
}) {
  const { custom, rooms, checkIn, checkOut } = props
  const nights = nightsBetween(checkIn, checkOut)
  const property = getCurrentProperty()
  const { setNights, setRoomCount, setPreviews } = custom

  useEffect(() => setNights(nights), [nights, setNights])
  useEffect(() => setRoomCount(rooms.length), [rooms.length, setRoomCount])

  // price each room at its agreed rate, so the desk sees the total and any rule it breaks
  const key = JSON.stringify([property, checkIn, checkOut, rooms, custom.rates])
  useEffect(() => {
    if (nights < 1) return
    let alive = true
    const timer = setTimeout(() => {
      rooms.forEach((r, i) => {
        if (!r.room_type) return
        const rt = custom.rates[i] ?? emptyRate()
        call<Preview>("kamra_custom.negotiation.preview", {
          property, room_type: r.room_type, check_in_date: checkIn, check_out_date: checkOut,
          adults: r.adults, children: r.children, meal_plan: r.meal_plan || undefined, rates: agreedRates(rt, nights),
        })
          .then((p) => alive && setPreviews((all) => ({ ...all, [i]: p })))
          .catch((e) => alive && setPreviews((all) => ({ ...all, [i]: rule(e) || "This room cannot be priced." })))
      })
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className="space-y-4">
      <div>
        <label className={label} htmlFor="custom-internal-remarks">Internal remarks</label>
        <textarea
          id="custom-internal-remarks"
          rows={2}
          className={field}
          value={custom.remarks}
          onChange={(e) => custom.setRemarks(e.target.value)}
          placeholder="For staff only: for example advance taken, who agreed the rate"
        />
      </div>

      {nights > 0
        ? rooms.map((_room, i) => {
            const p = custom.previews[i]
            const info = typeof p === "object" ? p : undefined
            const rt = custom.rates[i] ?? emptyRate()
            const problem = rateProblem(rt, nights, info)
            return (
              <div key={i} className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Room {i + 1}
                    {info ? (
                      <span className="font-normal text-zinc-500">
                        {" "}· system rate {fmtMoney(info.entry_rates[0])} per night {info.inclusive ? "with" : "before"} tax
                      </span>
                    ) : null}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rt.agree}
                      onChange={(e) =>
                        custom.setRate(i, {
                          agree: e.target.checked,
                          perNight: false,
                          rate: info?.entry_rates[0] !== undefined ? String(info.entry_rates[0]) : rt.rate,
                          nightly: (info?.entry_rates ?? []).map(String),
                        })
                      }
                    />
                    Agree a different rate
                  </label>
                </div>
                {typeof p === "string" ? <p className="text-rose-700">{p}</p> : null}
                {rt.agree ? (
                  <div className="space-y-2">
                    {!rt.perNight ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className={label} htmlFor={`custom-rate-${i}`}>Rate per night</label>
                          <input id={`custom-rate-${i}`} inputMode="decimal" className={`${field} w-40`} value={rt.rate}
                            onChange={(e) => custom.setRate(i, { rate: e.target.value })} />
                        </div>
                        {nights > 1 ? (
                          <button type="button" className="text-xs underline"
                            onClick={() => custom.setRate(i, { perNight: true, nightly: Array.from({ length: nights }, () => rt.rate) })}>
                            Different rate each night
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {Array.from({ length: nights }, (_, n) => (
                            <div key={n}>
                              <label className={label} htmlFor={`custom-night-${i}-${n}`}>Night {n + 1}</label>
                              <input id={`custom-night-${i}-${n}`} inputMode="decimal" className={field} value={rt.nightly[n] ?? ""}
                                onChange={(e) => custom.setRate(i, { nightly: Object.assign([...rt.nightly], { [n]: e.target.value }) })} />
                            </div>
                          ))}
                        </div>
                        <button type="button" className="mt-1 text-xs underline"
                          onClick={() => custom.setRate(i, { perNight: false, rate: rt.nightly[0] ?? rt.rate })}>
                          Same rate every night
                        </button>
                      </div>
                    )}
                    {info && info.discount_pct > 0 ? (
                      <div>
                        <p className="text-zinc-600">{info.discount_pct.toFixed(1)}% below the system rate.</p>
                        <label className={label} htmlFor={`custom-why-${i}`}>Reason for the discount</label>
                        <input id={`custom-why-${i}`} className={field} value={rt.reason}
                          onChange={(e) => custom.setRate(i, { reason: e.target.value })} />
                      </div>
                    ) : null}
                    {problem ? <p role="alert" className="text-rose-700">{problem}</p> : null}
                    {info ? (
                      <p className="text-right">
                        Room total with tax <b>{fmtMoney(info.negotiated?.amount_after_tax ?? info.system.amount_after_tax)}</b>
                        {info.negotiated ? <span className="text-zinc-500"> (system {fmtMoney(info.system.amount_after_tax)})</span> : null}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })
        : null}
    </div>
  )
}
