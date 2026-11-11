import { describe, expect, it } from "vitest"
import { oooProblem } from "../overlay/src/custom/outOfOrder"

describe("out of order form", () => {
  const today = "2026-11-11"
  it("needs a reason", () => {
    expect(oooProblem("  ", "2026-11-12", today)).toMatch(/why/)
    expect(oooProblem("ab", "2026-11-12", today)).toMatch(/why/)
  })
  it("needs a date, not in the past", () => {
    expect(oooProblem("AC repair", "", today)).toMatch(/until when/)
    expect(oooProblem("AC repair", "2026-11-10", today)).toMatch(/past/)
  })
  it("passes with both, today or later", () => {
    expect(oooProblem("AC repair", today, today)).toBe("")
    expect(oooProblem("AC repair", "2026-12-01", today)).toBe("")
  })
})
