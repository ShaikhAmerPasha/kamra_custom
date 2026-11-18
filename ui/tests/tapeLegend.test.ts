import { describe, expect, it } from "vitest"
import { legendCounts, matches, nightsOf } from "../overlay/src/custom/tapeLegend"

const today = "2026-11-18"
const stays = [
  { name: "A", status: "Checked In", check_in_date: "2026-11-16", check_out_date: today, due: 500 },
  { name: "B", status: "Confirmed", check_in_date: today, check_out_date: "2026-11-20", due: 0 },
  { name: "C", status: "Confirmed", check_in_date: "2026-11-25", check_out_date: "2026-11-26" },
]

describe("tape legend", () => {
  it("counts each kind, a stay once however many rooms rows repeat it", () => {
    const c = legendCounts([...stays, stays[0]], today, new Set(["B"]))
    expect(c).toEqual({ in_house: 1, reserved: 2, arriving: 1, leaving: 1, owing: 1, conflict: 1 })
  })
  it("a stay can fall in several kinds", () => {
    expect(matches("in_house", stays[0], today, new Set())).toBe(true)
    expect(matches("leaving", stays[0], today, new Set())).toBe(true)
    expect(matches("owing", stays[0], today, new Set())).toBe(true)
    expect(matches("reserved", stays[0], today, new Set())).toBe(false)
  })
  it("a reserved booking that has not paid is not owing yet", () => {
    expect(matches("owing", { ...stays[1], due: 3000 }, today, new Set())).toBe(false)
  })
  it("a missing balance is not owing", () => {
    expect(matches("owing", stays[2], today, new Set())).toBe(false)
  })
  it("nights are whole and at least one", () => {
    expect(nightsOf("2026-11-18", "2026-11-20")).toBe(2)
    expect(nightsOf("2026-11-18", "2026-11-18")).toBe(1)
  })
})
