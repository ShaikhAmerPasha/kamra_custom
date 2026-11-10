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
