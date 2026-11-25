import { describe, expect, it } from "vitest"
import { cardsPath, headState, idsFromQuery, keepShown, summary, toggle, toggleAll, MAX_TICKED } from "../overlay/src/custom/bulk"

describe("ticking rows", () => {
  it("toggles one row", () => {
    expect(toggle([], "A")).toEqual(["A"])
    expect(toggle(["A", "B"], "A")).toEqual(["B"])
  })

  it("select-all ticks what is shown, and clears when all are ticked", () => {
    expect(toggleAll([], ["A", "B"])).toEqual(["A", "B"])
    expect(toggleAll(["A"], ["A", "B"])).toEqual(["A", "B"])
    expect(toggleAll(["A", "B"], ["A", "B"])).toEqual([])
    expect(toggleAll([], [])).toEqual([])
  })

  it("never ticks more than the server takes", () => {
    const many = Array.from({ length: MAX_TICKED + 20 }, (_, i) => `R${i}`)
    expect(toggleAll([], many)).toHaveLength(MAX_TICKED)
  })

  it("a new search keeps only ticks still on the page", () => {
    expect(keepShown(["A", "Z"], ["A", "B"])).toEqual(["A"])
  })

  it("the header box is none, some or all", () => {
    expect(headState([], ["A", "B"])).toBe("none")
    expect(headState(["A"], ["A", "B"])).toBe("some")
    expect(headState(["A", "B"], ["A", "B"])).toBe("all")
  })
})

describe("telling the answer", () => {
  it("says all, some or none done", () => {
    expect(summary({ results: [], done: 3, failed: 0 }, "assign_rooms")).toBe("Assign rooms: all 3 done.")
    expect(summary({ results: [], done: 2, failed: 1 }, "check_in")).toBe("Check-in: 2 done, 1 not done. See the reasons below.")
    expect(summary({ results: [], done: 0, failed: 2 }, "verify_precheckin")).toBe("Pre-check-in validation: none done. See the reasons below.")
  })
})

describe("registration cards page address", () => {
  it("round-trips the bookings, dropping blanks and repeats", () => {
    const path = cardsPath(["RES-1", "RES-2"])
    expect(idsFromQuery(path.split("?")[1])).toEqual(["RES-1", "RES-2"])
    expect(idsFromQuery("ids=RES-1,,RES-1, RES-2 ")).toEqual(["RES-1", "RES-2"])
    expect(idsFromQuery("")).toEqual([])
  })
})
