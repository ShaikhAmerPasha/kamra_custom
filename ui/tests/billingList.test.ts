import { describe, expect, it } from "vitest"
import { foliosLabel, folioPath, pdfPath, rangeProblem } from "../overlay/src/custom/billingList"

describe("billing list helpers", () => {
  it("opens a folio, or prints it", () => {
    expect(folioPath("FOLIO-2026-01732")).toBe("/billing/FOLIO-2026-01732")
    expect(pdfPath("FOLIO-2026-01732")).toBe("/billing/FOLIO-2026-01732?print=1")
  })
  it("checks the date range", () => {
    expect(rangeProblem("2026-11-12", "2026-11-01")).toMatch(/after/)
    expect(rangeProblem("2026-11-01", "2026-11-12")).toBe("")
    expect(rangeProblem("", "2026-11-12")).toBe("")
  })
  it("says how many folios a stay has", () => {
    const f = { name: "", type: "", status: "", invoice_number: "", amount: 0, balance: 0 }
    expect(foliosLabel({ folios: [f] })).toBe("")
    expect(foliosLabel({ folios: [f, f] })).toBe("2 folios")
  })
})
