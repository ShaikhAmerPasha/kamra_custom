import { describe, expect, it } from "vitest"
import { revenueCaption } from "../overlay/src/custom/figureCaption"

describe("revenueCaption", () => {
  it("names the day", () => {
    expect(revenueCaption("today", "2026-11-20")).toBe("Total revenue for 20 Nov 2026: rooms, food and other.")
  })
  it("names the month so far", () => {
    expect(revenueCaption("month", "2026-11-20")).toBe("Total revenue from 1 Nov 2026 to 20 Nov 2026: rooms, food and other.")
  })
  it("is empty without a date", () => {
    expect(revenueCaption("today", null)).toBe("")
  })
})
