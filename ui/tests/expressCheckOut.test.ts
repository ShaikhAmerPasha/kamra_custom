import { describe, expect, it } from "vitest"
import { whyNotExpress, type CheckoutLike } from "../overlay/src/custom/expressCheckOut"

const usual: CheckoutLike = {
  reservation: { status: "Checked In", company: null },
  actions: { can_check_out_role: true },
  early_departure: null,
  late_checkout: null,
  city_ledger: [],
  credit: null,
  refunds: [],
  pending_bills: [],
  blockers: [],
  pin_required: false,
  deposit: null,
  collect: [{ amount: 3675 }],
  till_open: true,
  companions: [],
}

describe("one-page check-out", () => {
  it("is used for the usual stay", () => expect(whyNotExpress(usual)).toBe(""))
  it("is used when nothing is owed and the till is closed", () =>
    expect(whyNotExpress({ ...usual, collect: [], till_open: false })).toBe(""))
  it.each([
    ["early departure", { early_departure: {} }],
    ["late check-out", { late_checkout: { late: true, already_charged: false } }],
    ["company bill", { reservation: { status: "Checked In", company: "ACME" } }],
    ["refund", { refunds: [{}] }],
    ["bills not on the folio", { pending_bills: [{}] }],
    ["blocker", { blockers: [{ step: "review" }] }],
    ["till PIN", { pin_required: true }],
    ["security deposit", { deposit: { held: 100 } }],
    ["group", { companions: [{}] }],
    ["till closed", { till_open: false }],
  ])("falls back for %s", (why, patch) => expect(whyNotExpress({ ...usual, ...patch })).toBe(why))
  it("the owed-money blocker is cleared by the payment, so it is fine", () =>
    expect(whyNotExpress({ ...usual, blockers: [{ step: "settle" }] })).toBe(""))
  it("a late check-out already charged is fine", () =>
    expect(whyNotExpress({ ...usual, late_checkout: { late: true, already_charged: true } })).toBe(""))
})

import { allocate, isCash, tenderAmounts, tenderProblem } from "../overlay/src/custom/expressCheckOut"

describe("paying in more than one way", () => {
  const cash = { mode: "Cash", amount: "", reference: "" }
  it("cash needs no reference, the others do", () => {
    expect(isCash("Cash")).toBe(true)
    expect(isCash("Card")).toBe(false)
    expect(tenderProblem([cash], 3675)).toBe("")
    expect(tenderProblem([{ mode: "UPI", amount: "", reference: "" }], 3675)).toMatch(/reference/)
    expect(tenderProblem([{ mode: "UPI", amount: "", reference: "UTR123" }], 3675)).toBe("")
  })
  it("a blank last line takes the rest", () => {
    const lines = [{ mode: "Cash", amount: "1000", reference: "" }, { mode: "Card", amount: "", reference: "x" }]
    expect(tenderAmounts(lines, 3675)).toEqual([1000, 2675])
    expect(tenderProblem(lines, 3675)).toBe("")
  })
  it("the payments must add up to what is due", () => {
    const low = [{ mode: "Cash", amount: "1000", reference: "" }, { mode: "Card", amount: "1000", reference: "x" }]
    expect(tenderProblem(low, 3675)).toMatch(/less/)
    const high = [{ mode: "Cash", amount: "4000", reference: "" }]
    expect(tenderProblem(high, 3675)).toMatch(/more/)
  })
  it("asks for an amount on every line", () => {
    expect(tenderProblem([{ mode: "Cash", amount: "0", reference: "" }], 100)).toMatch(/amount/)
  })
  it("nothing is asked when nothing is due", () => expect(tenderProblem([], 0)).toBe(""))
  it("shares the payments over the folios", () => {
    const out = allocate(
      [{ mode: "Cash", amount: 1000, reference: "" }, { mode: "Card", amount: 2675, reference: "r1" }],
      [{ folio: "F1", amount: 3000 }, { folio: "F2", amount: 675 }],
    )
    expect(out).toEqual([
      { folio: "F1", mode: "Cash", amount: 1000, reference: "" },
      { folio: "F1", mode: "Card", amount: 2000, reference: "r1" },
      { folio: "F2", mode: "Card", amount: 675, reference: "r1" },
    ])
  })
  it("keeps cents exact", () => {
    const out = allocate([{ mode: "Cash", amount: 0.1, reference: "" }, { mode: "Card", amount: 0.2, reference: "r" }], [{ folio: "F", amount: 0.3 }])
    expect(out.reduce((s, p) => s + Math.round(p.amount * 100), 0)).toBe(30)
  })
})
