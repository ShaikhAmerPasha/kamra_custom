import { describe, expect, it } from "vitest"
import { averageRate, detailRows, sections, type DetailInput } from "../overlay/src/custom/stayDetails"

const fmt = { money: (n: number) => `₹${Math.round(n)}`, day: (s: string | null | undefined) => s ?? "" }
const base: DetailInput = {
  name: "RES-1", check_in_date: "2026-11-18", check_out_date: "2026-11-20", nights: 2, adults: 2, children: 1,
  room_number: "301", room_type_name: "Deluxe Room", meal_plan: "EP", meal_plan_name: "European Plan", rate_plan: null,
  source: "Manual", channel: null, company: null, travel_agent: null, special_requests: null,
  guest: { full_name: "Tape Arrive Today", vip: 0, stays: 0, last_stay: null },
}
const get = (rows: ReturnType<typeof detailRows>, key: string) => rows.find((r) => r.key === key)

describe("stay details", () => {
  it("shows guest, stay, room, rate and booking source", () => {
    const rows = detailRows({ ...base, night_rates: [{ rate: 3000 }, { rate: 3200 }] }, fmt)
    expect(get(rows, "guest")?.value).toBe("Tape Arrive Today · First stay")
    expect(get(rows, "stay")?.value).toBe("2026-11-18 → 2026-11-20 · 2 nights · 2 adults + 1 child")
    expect(get(rows, "room")?.value).toBe("301 · Deluxe Room")
    expect(get(rows, "rate")?.value).toBe("European Plan · ₹3100 a night")
    expect(get(rows, "booked")?.value).toBe("Manual")
  })
  it("leaves out what is empty", () => {
    const keys = detailRows(base, fmt).map((r) => r.key)
    expect(keys).not.toContain("deposit")
    expect(keys).not.toContain("security")
    expect(keys).not.toContain("requests")
    expect(keys).not.toContain("notes")
  })
  it("shows a VIP with earlier stays", () => {
    const rows = detailRows({ ...base, guest: { full_name: "A B", vip: 1, stays: 3, last_stay: "2026-05-01" } }, fmt)
    expect(get(rows, "guest")?.value).toBe("A B · VIP · 3 earlier stays, last 2026-05-01")
  })
  it("warns when a deposit is still due", () => {
    const r = get(detailRows({ ...base, deposit: { expected: 2000, paid: 500, due: 1500 } }, fmt), "deposit")
    expect(r?.tone).toBe("warn")
    expect(r?.value).toBe("required ₹2000 · received ₹500 · still due ₹1500")
    expect(get(detailRows({ ...base, deposit: { expected: 2000, paid: 2000, due: 0 } }, fmt), "deposit")?.tone).toBe("ok")
  })
  it("shows a held security deposit, not a waived one", () => {
    expect(get(detailRows({ ...base, security_deposit: { status: "Held", held: 1000, collected: 1000, required: 1000 } }, fmt), "security")?.value).toBe("Held · held ₹1000")
    expect(get(detailRows({ ...base, security_deposit: { status: "Waived", held: 0, collected: 0, required: 1000 } }, fmt), "security")).toBeUndefined()
  })
  it("shows company, agent, requests and staff notes", () => {
    const rows = detailRows({ ...base, company: "Acme", travel_agent: "Trips", special_requests: "Late arrival", internal_remarks: "Regular" }, fmt)
    expect(get(rows, "booked")?.value).toBe("Manual · company Acme · agent Trips")
    expect(get(rows, "requests")?.value).toBe("Late arrival")
    expect(get(rows, "notes")?.value).toBe("Regular")
  })
  it("averages the nightly rate, and is zero with none", () => {
    expect(averageRate([{ rate: 100 }, { rate: 200 }])).toBe(150)
    expect(averageRate(undefined)).toBe(0)
    expect(averageRate([])).toBe(0)
  })

  it("groups rows into sections, only those with something to show", () => {
    const rows = detailRows(base, fmt)
    expect(sections(rows).map((x) => x.key)).toEqual(["guest", "stay"])
    const all = detailRows({ ...base, deposit: { expected: 2000, paid: 0, due: 2000 }, special_requests: "Late arrival" }, fmt)
    expect(sections(all).map((x) => x.key)).toEqual(["guest", "stay", "money", "notes"])
  })
  it("marks a section that needs the desk's eye", () => {
    const all = sections(detailRows({ ...base, deposit: { expected: 2000, paid: 0, due: 2000 }, special_requests: "Late arrival" }, fmt))
    expect(all.find((x) => x.key === "money")?.alert).toBe(true)
    expect(all.find((x) => x.key === "notes")?.alert).toBe(true)
    expect(all.find((x) => x.key === "stay")?.alert).toBe(false)
    const paid = sections(detailRows({ ...base, deposit: { expected: 2000, paid: 2000, due: 0 } }, fmt))
    expect(paid.find((x) => x.key === "money")?.alert).toBe(false)
  })
})

import { denseSections } from "../overlay/src/custom/stayDetails"
describe("denseSections", () => {
  const base2: DetailInput = {
    name: "RES-1", check_in_date: "2026-11-24", check_out_date: "2026-11-26", nights: 2, adults: 2, children: 0,
    room_number: "302", room_type_name: "Deluxe Room", meal_plan: "EP", rate_plan: null, source: "Manual", channel: null,
    company: null, travel_agent: null, special_requests: null, guest: { full_name: "A B", vip: 0, stays: 0, last_stay: null },
  }
  const f2 = { money: (n: number) => `₹${n}`, day: (s: string | null | undefined) => s ?? "" }
  it("gives one field to a row, grouped in bars", () => {
    const b = denseSections({ ...base2, night_rates: [{ rate: 3000 }, { rate: 3200 }] }, f2)
    expect(b.map((x) => x.title)).toEqual(["Stay", "Rate", "Booking"])
    const stay = b[0].rows.map((r) => [r.label, r.value])
    expect(stay).toContainEqual(["Arrival", "2026-11-24"])
    expect(stay).toContainEqual(["Nights", "2"])
    expect(stay).toContainEqual(["Room type", "Deluxe Room"])
    expect(b[1].rows.find((r) => r.label === "Rate a night")?.value).toBe("₹3100")
  })
  it("leaves out empty rows and empty bars", () => {
    const b = denseSections(base2, f2)
    expect(b.some((x) => x.title === "Deposits")).toBe(false)
    expect(b.some((x) => x.title === "Notes")).toBe(false)
  })
  it("marks money still to collect", () => {
    const b = denseSections({ ...base2, deposit: { expected: 2000, paid: 500, due: 1500 } }, f2)
    const dep = b.find((x) => x.title === "Deposits")!
    expect(dep.rows.find((r) => r.label === "To collect")).toMatchObject({ value: "₹1500", tone: "warn" })
    expect(dep.rows.find((r) => r.label === "Received")?.value).toBe("₹500")
  })
})
