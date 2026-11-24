import { describe, expect, it } from "vitest"
import { ratesVary, roomWithMeal, trailLine, when } from "../overlay/src/custom/stayFacts"

const base = { reserved_by: "", reserved_at: "", changed_by: "", changed_at: "", checked_in_by: "", checked_in_at: "", checked_out_at: "" }

describe("when", () => {
  it("shortens a stamp", () => expect(when("2026-11-20 10:27:41")).toBe("20 Nov 10:27"))
  it("leaves other text alone", () => expect(when("soon")).toBe("soon"))
  it("handles nothing", () => expect(when(null)).toBe(""))
})

describe("trailLine", () => {
  it("names who reserved and when", () => {
    expect(trailLine({ ...base, reserved_by: "Ameer", reserved_at: "2026-11-20 10:27" })).toBe("Reserved by Ameer on 20 Nov 10:27")
  })
  it("adds the last change and the check-in", () => {
    const s = trailLine({ ...base, reserved_by: "A", reserved_at: "2026-11-20 10:00", changed_by: "B", changed_at: "2026-11-20 10:30", checked_in_by: "C", checked_in_at: "2026-11-20 11:00" })
    expect(s).toContain("last changed by B")
    expect(s).toContain("checked in by C on 20 Nov 11:00")
  })
  it("does not call the booking itself a change", () => {
    expect(trailLine({ ...base, reserved_by: "A", reserved_at: "2026-11-20 10:00", changed_by: "A", changed_at: "2026-11-20 10:00" })).not.toContain("changed")
  })
  it("is empty with no data", () => expect(trailLine(base)).toBe(""))
})

describe("ratesVary", () => {
  const row = (room: number, date: string | null = "2026-11-20") => ({ date, room, meal: 0, tax: 0, total: room, gst_rate: 5 })
  it("is true when nights differ", () => expect(ratesVary([row(2700), row(3000, "2026-11-21")])).toBe(true))
  it("is false when they match", () => expect(ratesVary([row(2700), row(2700, "2026-11-21")])).toBe(false))
  it("ignores the discount row", () => expect(ratesVary([row(2700), row(0, null)])).toBe(false))
})

describe("roomWithMeal", () => {
  it("folds the meal into the room", () => expect(roomWithMeal({ room: 2142.86, meal: 1000 })).toBe(3142.86))
  it("is the room alone with no meal", () => expect(roomWithMeal({ room: 2700, meal: 0 })).toBe(2700))
})
