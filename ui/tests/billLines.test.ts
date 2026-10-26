import { describe, expect, it } from "vitest"
import { mealName, mergeMealIntoRoom, type BillCharge } from "@custom/billLines"

const c = (over: Partial<BillCharge>): BillCharge => ({
  name: "x", posting_date: "2026-10-25", charge_type: "Room", description: "Room 201 · Deluxe",
  amount: 2000, gst_rate: 5, gst_amount: 100, total: 2100, ...over,
})
const meal = (date = "2026-10-25", over: Partial<BillCharge> = {}) =>
  c({ name: `m-${date}`, posting_date: date, charge_type: "Meal Plan", description: "Continental Plan × 2 adult(s)", amount: 1000, gst_amount: 50, total: 1050, ...over })

describe("mergeMealIntoRoom", () => {
  it("names the meal without its head count", () => expect(mealName("Continental Plan × 2 adult(s)")).toBe("Continental Plan"))

  it("puts the night's room and meal on one line, adding the amounts", () => {
    const [line] = mergeMealIntoRoom([c({ name: "r1" }), meal()])
    expect(line).toMatchObject({ amount: 3000, gst_rate: 5, gst_amount: 150, total: 3150 })
    expect(line.item).toBe("Room - Room 201 · Deluxe with Continental Plan")
  })

  it("keeps the bill total the same", () => {
    const charges = [c({ name: "r1" }), meal(), c({ name: "f1", charge_type: "Food & Beverage", description: "Dinner", total: 500, amount: 476, gst_amount: 24 })]
    const sum = (xs: { total: number }[]) => xs.reduce((a, b) => a + b.total, 0)
    expect(sum(mergeMealIntoRoom(charges))).toBe(sum(charges))
  })

  it("says mixed when room and meal are taxed at different rates", () => {
    const [line] = mergeMealIntoRoom([c({ name: "r1", gst_rate: 12 }), meal()])
    expect(line.gst_rate).toBeNull()
  })

  it("merges each night on its own", () => {
    const lines = mergeMealIntoRoom([
      c({ name: "r1", posting_date: "2026-10-25" }), meal("2026-10-25"),
      c({ name: "r2", posting_date: "2026-10-26" }), meal("2026-10-26"),
    ])
    expect(lines.map((l) => l.date)).toEqual(["2026-10-25", "2026-10-26"])
    expect(lines.every((l) => l.amount === 3000)).toBe(true)
  })

  it("leaves a room with no meal, and other charges, as they are", () => {
    const lines = mergeMealIntoRoom([c({ name: "r1" }), c({ name: "f1", charge_type: "Laundry", description: "", total: 50 })])
    expect(lines.map((l) => l.item)).toEqual(["Room - Room 201 · Deluxe", "Laundry"])
  })

  it("keeps a meal that has no room line that night", () => {
    const lines = mergeMealIntoRoom([meal("2026-10-27")])
    expect(lines).toHaveLength(1)
    expect(lines[0].item).toBe("Meal Plan - Continental Plan × 2 adult(s)")
  })

  it("does not use one meal twice when a night has two room lines", () => {
    const lines = mergeMealIntoRoom([c({ name: "r1" }), c({ name: "r2" }), meal()])
    expect(lines.filter((l) => l.item.includes("Continental")).length).toBe(1)
  })
})
