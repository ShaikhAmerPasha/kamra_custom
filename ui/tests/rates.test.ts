import { describe, expect, it } from "vitest"
import { agreedRates, customRate, emptyRate, nightsBetween, rateProblem } from "@custom/rates"

const agree = (over = {}) => ({ ...emptyRate(), agree: true, rate: "2100", ...over })

describe("nightsBetween", () => {
  it("counts nights", () => expect(nightsBetween("2026-11-01", "2026-11-03")).toBe(2))
  it("is zero when a date is missing", () => expect(nightsBetween("", "2026-11-03")).toBe(0))
})

describe("agreedRates", () => {
  it("is undefined while the system rate stands", () => expect(agreedRates(emptyRate(), 2)).toBeUndefined())
  it("repeats one rate for every night", () => expect(agreedRates(agree(), 3)).toEqual([2100, 2100, 2100]))
  it("takes each night's own rate", () =>
    expect(agreedRates(agree({ perNight: true, nightly: ["2000", "2400"] }), 2)).toEqual([2000, 2400]))
  it("is undefined for a blank or negative rate", () => {
    expect(agreedRates(agree({ rate: "" }), 2)).toBeUndefined()
    expect(agreedRates(agree({ rate: "-1" }), 2)).toBeUndefined()
  })
  it("is undefined without nights", () => expect(agreedRates(agree(), 0)).toBeUndefined())
})

describe("customRate", () => {
  it("carries the rates and the trimmed reason", () =>
    expect(customRate(agree({ reason: " bargain " }), 2)).toEqual({ rates: [2100, 2100], reason: "bargain" }))
  it("is undefined when nothing was agreed", () => expect(customRate(emptyRate(), 2)).toBeUndefined())
})

describe("rateProblem", () => {
  const ok = { discount_pct: 0, needs_manager: false, can_approve: false }
  it("has no problem when the system rate stands", () => expect(rateProblem(emptyRate(), 2, undefined)).toBe(""))
  it("asks for the rate", () => expect(rateProblem(agree({ rate: "" }), 2, ok)).toBe("Enter the rate."))
  it("waits for the check", () => expect(rateProblem(agree(), 2, undefined)).toBe("Checking the rate."))
  it("passes the server's rule message on", () =>
    expect(rateProblem(agree(), 2, { ...ok, rule_error: "below the floor" })).toBe("below the floor"))
  it("asks for a manager when the discount is too large", () =>
    expect(rateProblem(agree(), 2, { discount_pct: 30, needs_manager: true, can_approve: false })).toContain("manager"))
  it("lets a manager go on", () =>
    expect(rateProblem(agree({ reason: "x" }), 2, { discount_pct: 30, needs_manager: true, can_approve: true })).toBe(""))
  it("needs a reason for a discount", () => {
    expect(rateProblem(agree(), 2, { ...ok, discount_pct: 5 })).toBe("Say why the rate was reduced.")
    expect(rateProblem(agree({ reason: "regular" }), 2, { ...ok, discount_pct: 5 })).toBe("")
  })
})
