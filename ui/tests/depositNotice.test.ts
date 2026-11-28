import { describe, expect, it } from "vitest"
import { depositNotice } from "../overlay/src/custom/depositNotice"

const d = (security: Partial<{ status: string; required: number; held: number; due: number }>, satisfied = true) => ({
  satisfied,
  security: { status: "Required", required: 5000, held: 0, ...security },
})

describe("depositNotice", () => {
  it("is due when the stay asks for money and none is held, even if Kamra says satisfied", () => {
    expect(depositNotice(d({}, true))).toEqual({ kind: "due", amount: 5000 })
  })
  it("uses Kamra's due figure when it has one", () => {
    expect(depositNotice(d({ held: 2000, due: 3000 }))).toEqual({ kind: "due", amount: 3000 })
  })
  it("is due for the rest when only part is held", () => {
    expect(depositNotice(d({ status: "Held", held: 2000 }))).toEqual({ kind: "due", amount: 3000 })
  })
  it("is taken when the full amount is held", () => {
    expect(depositNotice(d({ status: "Held", held: 5000 }))).toEqual({ kind: "taken", amount: 5000 })
  })
  it("is waived when waived, whatever is required", () => {
    expect(depositNotice(d({ status: "Waived" }))).toEqual({ kind: "waived" })
  })
  it("says nothing when no deposit is asked for", () => {
    expect(depositNotice(d({ status: "None", required: 0 }))).toEqual({ kind: "none" })
  })
})

import { securityInUse, securityLeftOver } from "../overlay/src/custom/depositNotice"

describe("a leftover security deposit row", () => {
  const row = { status: "Required", required: 5000, held: 0, collected: 0, policy_amount: 0 }
  it("is left over when the property takes none and nothing was collected", () => {
    expect(securityLeftOver(row)).toBe(true)
    expect(securityInUse(row)).toBe(false)
    expect(depositNotice({ satisfied: true, security: row })).toEqual({ kind: "none" })
  })
  it("is still asked for when the property has a deposit policy", () => {
    expect(securityLeftOver({ ...row, policy_amount: 5000 })).toBe(false)
    expect(depositNotice({ satisfied: false, security: { ...row, policy_amount: 5000 } })).toEqual({ kind: "due", amount: 5000 })
  })
  it("is never hidden once money was collected or is held", () => {
    expect(securityInUse({ ...row, collected: 1000 })).toBe(true)
    expect(securityInUse({ ...row, status: "Held", held: 5000 })).toBe(true)
  })
  it("is not in use when there is no row", () => {
    expect(securityInUse({ status: "None", required: 0, held: 0 })).toBe(false)
    expect(securityInUse(null)).toBe(false)
  })
})
