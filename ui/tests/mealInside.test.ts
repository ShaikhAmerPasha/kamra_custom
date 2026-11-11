import { describe, expect, it } from "vitest"
import { foldMealHead, foldMealIntoRoom, planName } from "../overlay/src/custom/mealInside"

const room = (d: string, amount = 2500) => ({ charge_type: "Room", description: "Room 201 · DLX", amount, gst_amount: amount * 0.05, total: amount * 1.05, gst_rate: 5, posting_date: d })
const meal = (d: string, amount = 500, rate = 5) => ({ charge_type: "Meal Plan", description: "European Plan × 1 adult(s)", amount, gst_amount: amount * rate / 100, total: amount * (1 + rate / 100), gst_rate: rate, posting_date: d })
const fnb = { charge_type: "Food & Beverage", description: "Dinner", amount: 2000, gst_amount: 100, total: 2100, gst_rate: 5, posting_date: "2026-11-11" }

describe("meal inside the room line", () => {
  it("names the plan without the guest count", () => expect(planName("European Plan × 2 adult(s)")).toBe("European Plan"))
  it("one room line a night, the meal added in", () => {
    const out = foldMealIntoRoom([room("2026-11-11"), meal("2026-11-11"), fnb])
    expect(out).toHaveLength(2)
    expect(out[0].charge_type).toBe("Room")
    expect(out[0].amount).toBe(3000)
    expect(out[0].gst_amount).toBe(150)
    expect(out[0].total).toBe(3150)
    expect(out[0].description).toBe("Room 201 · DLX with European Plan")
    expect(out[1]).toBe(fnb)
  })
  it("no Meal Plan line is left", () => {
    const out = foldMealIntoRoom([room("2026-11-11"), meal("2026-11-11"), room("2026-11-12"), meal("2026-11-12")])
    expect(out.some((r) => r.charge_type === "Meal Plan")).toBe(false)
    expect(out).toHaveLength(2)
  })
  it("keeps the bill total exactly", () => {
    const rows = [room("2026-11-11"), meal("2026-11-11"), fnb]
    const sum = (r: typeof rows) => r.reduce((s, x) => s + (x.total ?? 0), 0)
    expect(sum(foldMealIntoRoom(rows) as typeof rows)).toBeCloseTo(sum(rows), 6)
  })
  it("says when room and meal are taxed differently", () => {
    const out = foldMealIntoRoom([room("2026-11-11", 9000), meal("2026-11-11", 500, 5)].map((r, i) => (i === 0 ? { ...r, gst_rate: 18 } : r)))
    expect(out[0].mixedTax).toBe(true)
  })
  it("pairs by order when the lines have no date", () => {
    const strip = <T extends { posting_date?: string }>(r: T) => ({ ...r, posting_date: undefined })
    const out = foldMealIntoRoom([room("a"), room("b"), meal("a"), meal("b")].map(strip))
    expect(out).toHaveLength(2)
    expect(out.every((r) => r.amount === 3000)).toBe(true)
  })
  it("leaves a bill with no meal alone", () => {
    const rows = [room("2026-11-11"), fnb]
    expect(foldMealIntoRoom(rows)).toEqual(rows)
  })
  it("adds the Meal Plan head to the Room head", () => {
    const heads = [
      { head: "Room", lines: 1, amount: 2500, tax: 125, total: 2625 },
      { head: "Meal Plan", lines: 1, amount: 500, tax: 25, total: 525 },
      { head: "Food & Beverage", lines: 1, amount: 2000, tax: 100, total: 2100 },
    ]
    const out = foldMealHead(heads)
    expect(out.map((h) => h.head)).toEqual(["Room", "Food & Beverage"])
    expect(out[0]).toMatchObject({ amount: 3000, tax: 150, total: 3150 })
  })
})
