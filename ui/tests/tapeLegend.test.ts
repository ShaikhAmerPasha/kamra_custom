import { describe, expect, it } from "vitest"
import { arrivalNotReady, dayMovement, legendCounts, matches, nightsOf } from "../overlay/src/custom/tapeLegend"

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

  it("counts arrivals and departures per day, each stay once", () => {
    const m = dayMovement(
      [
        { name: "A", check_in_date: "2026-11-18", check_out_date: "2026-11-19" },
        { name: "A", check_in_date: "2026-11-18", check_out_date: "2026-11-19" },
        { name: "B", check_in_date: "2026-11-19", check_out_date: "2026-11-21" },
        { name: "C", check_in_date: "2026-11-10", check_out_date: "2026-11-30" },
      ],
      ["2026-11-18", "2026-11-19", "2026-11-20"],
    )
    expect(m).toEqual({ "2026-11-18": { arr: 1, dep: 0 }, "2026-11-19": { arr: 1, dep: 1 }, "2026-11-20": { arr: 0, dep: 0 } })
  })
  it("marks an arrival today into a dirty or out-of-order room", () => {
    const b = { status: "Confirmed", check_in_date: today }
    expect(arrivalNotReady(b, "Dirty", today)).toBe(true)
    expect(arrivalNotReady(b, "Out of Order", today)).toBe(true)
    expect(arrivalNotReady(b, "Clean", today)).toBe(false)
    expect(arrivalNotReady({ ...b, check_in_date: "2026-11-25" }, "Dirty", today)).toBe(false)
    expect(arrivalNotReady({ ...b, status: "Checked In" }, "Dirty", today)).toBe(false)
  })
})
