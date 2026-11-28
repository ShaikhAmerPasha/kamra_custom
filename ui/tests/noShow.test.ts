import { describe, expect, it } from "vitest"
import { creditLine, feeLine, noShowBlock, type NoShowPreview } from "../overlay/src/custom/noShow"

const m = (n: number) => `₹${n}`
const p = (o: Partial<NoShowPreview> = {}): NoShowPreview => ({
  reservation: "R", guest_name: "G", check_in_date: "2026-11-25", fee: "none", fee_reason: "", fee_amount: 0, fee_total: 0,
  paid: 0, credit_after: 0, credit_default: "Refund", ...o,
})

describe("feeLine", () => {
  it("states the charge with tax", () => {
    expect(feeLine(p({ fee: "charge", fee_total: 2625 }), m)).toBe("The no-show policy charges ₹2625, tax included.")
  })
  it("gives the reason when there is no fee", () => {
    expect(feeLine(p({ fee_reason: "OTA booking" }), m)).toBe("No fee: OTA booking")
    expect(feeLine(p(), m)).toBe("No fee is charged.")
  })
})

describe("creditLine", () => {
  it("says nothing when nothing was paid", () => expect(creditLine(p(), m)).toBeNull())
  it("says the payment covers the fee", () => expect(creditLine(p({ paid: 1000 }), m)).toBe("₹1000 paid is used for the fee."))
  it("names the default for the credit left", () => {
    expect(creditLine(p({ paid: 5000, credit_after: 2375 }), m)).toContain("₹2375")
    expect(creditLine(p({ paid: 5000, credit_after: 2375 }), m)).toContain("refunded")
    expect(creditLine(p({ credit_after: 10, credit_default: "Keep" }), m)).toContain("kept as credit")
  })
})

describe("noShowBlock", () => {
  it("blocks only when the desk may not yet", () => {
    expect(noShowBlock(false)).toContain("night audit")
    expect(noShowBlock(true)).toBe("")
    expect(noShowBlock(undefined)).toBe("")
  })
})
