import { describe, expect, it } from "vitest"
import { lineProblem, lineTotals, toPayload } from "../overlay/src/custom/extraCharges"

const rates = [0, 5, 12, 18, 28]

describe("extra charges", () => {
  it("adds the GST on top of the amount", () => {
    expect(lineTotals("1000", "18")).toEqual({ net: 1000, gst: 180, total: 1180 })
    expect(lineTotals("1200", "5")).toEqual({ net: 1200, gst: 60, total: 1260 })
  })
  it("rounds the GST to the paisa", () => {
    expect(lineTotals("333", "18")).toEqual({ net: 333, gst: 59.94, total: 392.94 })
    expect(lineTotals("99.99", "12").gst).toBe(12)
  })
  it("treats empty or bad fields as zero, never NaN", () => {
    expect(lineTotals("", "")).toEqual({ net: 0, gst: 0, total: 0 })
    expect(lineTotals("abc", "18")).toEqual({ net: 0, gst: 0, total: 0 })
    expect(lineTotals("500", "x")).toEqual({ net: 500, gst: 0, total: 500 })
    expect(lineTotals("1,000", "18").total).toBe(1180)
  })
  it("says what is missing", () => {
    expect(lineProblem({ description: " ", amount: "100", gst: "18" }, rates)).toMatch(/Name/)
    expect(lineProblem({ description: "Drop", amount: "0", gst: "18" }, rates)).toMatch(/amount/)
    expect(lineProblem({ description: "Drop", amount: "100", gst: "abc" }, rates)).toMatch(/GST percentage/)
  })
  it("refuses a rate the country does not allow, and allows a blank as none", () => {
    expect(lineProblem({ description: "Drop", amount: "100", gst: "17" }, rates)).toMatch(/not allowed/)
    expect(lineProblem({ description: "Drop", amount: "100", gst: "18" }, rates)).toBe("")
    expect(lineProblem({ description: "Drop", amount: "100", gst: "" }, rates)).toBe("")
  })
  it("builds what the server takes", () => {
    expect(toPayload({ description: " Airport drop ", amount: "1,000", gst: "18" })).toEqual({ description: "Airport drop", amount: 1000, gst_rate: 18 })
    expect(toPayload({ description: "Tour", amount: "500", gst: "" }).gst_rate).toBe(0)
  })
})
