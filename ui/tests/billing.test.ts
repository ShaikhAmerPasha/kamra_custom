import { describe, expect, it } from "vitest"
import {
  EMPTY_BILLING, auditParts, billingArgs, billingFromServer, billingProblem, billingSave, sameBilling,
} from "../overlay/src/custom/billing"

describe("billing and analysis", () => {
  it("an untouched form sends nothing", () => {
    expect(billingArgs(EMPTY_BILLING)).toBeUndefined()
  })

  it("sends only what was filled, GST and PAN in capitals", () => {
    expect(billingArgs({ ...EMPTY_BILLING, pay_by: "Card", gst_number: " 33abcde1234f1z5 ", guaranteed: true, credit_limit: "2500" })).toEqual({
      pay_by: "Card", gst_number: "33ABCDE1234F1Z5", guaranteed: 1, credit_limit: 2500,
    })
  })

  it("names the first problem: GST, then PAN, then credit limit", () => {
    expect(billingProblem(EMPTY_BILLING)).toBe("")
    expect(billingProblem({ ...EMPTY_BILLING, gst_number: "123" })).toMatch(/GST/)
    expect(billingProblem({ ...EMPTY_BILLING, pan_number: "ABC" })).toMatch(/PAN/)
    expect(billingProblem({ ...EMPTY_BILLING, credit_limit: "-5" })).toMatch(/Credit limit/)
    expect(billingProblem({ ...EMPTY_BILLING, credit_limit: "abc" })).toMatch(/Credit limit/)
    expect(billingProblem({ ...EMPTY_BILLING, gst_number: "33abcde1234f1z5", pan_number: "abcde1234f", credit_limit: "10" })).toBe("")
  })

  it("reads server values and saves every field, so a cleared box clears the stay", () => {
    const b = billingFromServer({ pay_by: "Company", tax_exempt: 1, guaranteed: 0, credit_limit: 0, gst_number: "", domicile: "India" })
    expect(b).toMatchObject({ pay_by: "Company", tax_exempt: true, guaranteed: false, credit_limit: "", domicile: "India" })
    expect(billingSave({ ...EMPTY_BILLING })).toEqual({
      pay_by: "", tax_exempt: 0, gst_number: "", pan_number: "", credit_limit: 0, guaranteed: 0, special_guest: 0, business_source: "", domicile: "",
    })
    expect(sameBilling(b, { ...b, gst_number: " " })).toBe(true)
    expect(sameBilling(b, { ...b, special_guest: true })).toBe(false)
  })

  it("lays out MyCloud's footer", () => {
    const parts = auditParts({
      reserved_by: "Asha", reserved_on: "2026-11-25 10:30:00.123", amended_by: null, amended_on: null,
      checked_in_by: "Ravi", checked_in_on: "2026-11-26 14:05:00", checked_out_on: null,
    })
    expect(parts).toEqual([
      ["Reserved", "Asha / 2026-11-25 10:30"], ["Last amended", ""], ["Checked in", "Ravi / 2026-11-26 14:05"], ["Checked out", ""],
    ])
  })
})
