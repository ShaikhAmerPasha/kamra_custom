import { describe, expect, it } from "vitest"
import { addDaysISO, isISODate, nightsFromDates } from "../overlay/src/custom/stay"
import { grcRoomLabel } from "../overlay/src/custom/grcLabel"

const t = (s: string) => s

describe("stay dates", () => {
  it("adds nights to a date, across a month and a year end", () => {
    expect(addDaysISO("2026-10-30", 3)).toBe("2026-11-02")
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29")
  })
  it("turns two dates into nights, at least one", () => {
    expect(nightsFromDates("2026-10-23", "2026-10-26")).toBe(3)
    expect(nightsFromDates("2026-10-23", "2026-10-23")).toBe(1)
    expect(nightsFromDates("2026-10-23", "2026-10-20")).toBe(1)
    expect(nightsFromDates("2026-10-23", "")).toBe(1)
  })
  it("nights and check-out always agree", () => {
    for (const n of [1, 2, 7, 31, 45]) expect(nightsFromDates("2026-10-23", addDaysISO("2026-10-23", n))).toBe(n)
  })
  it("rejects a bad date", () => {
    expect(isISODate("2026-13-40")).toBe(false)
    expect(isISODate("23/10/2026")).toBe(false)
    expect(isISODate("2026-10-23")).toBe(true)
  })
})

describe("registration card room line", () => {
  const stay = { room_number: "101", room_type: "DLX", room_type_name: "Deluxe Room" }
  it("shows the category only before check-in, even when Kamra already holds a room", () => {
    expect(grcRoomLabel({ ...stay, status: "Confirmed" }, t)).toBe("Deluxe Room")
  })
  it("shows number and category once checked in", () => {
    expect(grcRoomLabel({ ...stay, status: "Checked In" }, t)).toBe("101 · Deluxe Room")
    expect(grcRoomLabel({ ...stay, status: "Checked Out" }, t)).toBe("101 · Deluxe Room")
  })
  it("falls back to the type code, then to Unassigned", () => {
    expect(grcRoomLabel({ status: "Confirmed", room_type: "DLX" }, t)).toBe("DLX")
    expect(grcRoomLabel({ status: "Confirmed" }, t)).toBe("Unassigned")
  })
  it("keeps Kamra's own line when the switch is off", () => {
    expect(grcRoomLabel({ ...stay, status: "Confirmed" }, t, false)).toBe("101 · Deluxe Room")
    expect(grcRoomLabel({ status: "Confirmed" }, t, false)).toBe("Unassigned")
  })
})
