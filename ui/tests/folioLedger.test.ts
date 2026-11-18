import { describe, expect, it } from "vitest"
import { cashierName, ledgerRows, sections, strip, when } from "../overlay/src/custom/folioLedger"

const pays = [
  { posting_date: "2026-11-18", mode: "Card", amount: 3000, reference: "CARD-4411", creation: "2026-11-18 16:10:03.1", owner: "asha@hotel.com" },
  { posting_date: "2026-11-18", mode: "Cash", amount: 1500, reference: null, creation: "2026-11-18 09:05:00", owner: "Administrator" },
  { posting_date: "2026-11-18", mode: "Cash", amount: 500, reference: "R-2", creation: "2026-11-18 11:00:00", owner: "Administrator", payment_kind: "Advance" },
]

describe("folio ledger", () => {
  it("shows the time to the minute, or the date when there is none", () => {
    expect(when(pays[0])).toBe("2026-11-18 16:10")
    expect(when({ posting_date: "2026-11-11" })).toBe("2026-11-11")
  })
  it("names the cashier by the part before the @", () => {
    expect(cashierName("asha@hotel.com")).toBe("asha")
    expect(cashierName("Administrator")).toBe("Administrator")
    expect(cashierName(null)).toBe("")
  })
  it("lists payments in the order they were posted, kind defaulting to Payment", () => {
    const rows = ledgerRows(pays)
    expect(rows.map((r) => r.amount)).toEqual([1500, 500, 3000])
    expect(rows.map((r) => r.kind)).toEqual(["Payment", "Advance", "Payment"])
    expect(rows[0].reference).toBe("")
  })
  it("groups by mode with a subtotal each", () => {
    const s = sections(ledgerRows(pays), "mode")
    expect(s.map((x) => [x.label, x.total])).toEqual([["Cash", 2000], ["Card", 3000]])
    expect(sections(ledgerRows(pays), "time")).toHaveLength(1)
  })
  it("splits discounts from charges and reads the balance", () => {
    const s = strip(
      [{ charge_type: "Room", amount: 5000, total: 5000 }, { charge_type: "Allowance", amount: -500, total: -500 }],
      0,
      4500,
    )
    expect(s).toMatchObject({ charges: 5000, discount: -500, paid: 0, balance: 4500, tone: "owing" })
    expect(strip([], 100, 0).tone).toBe("settled")
    expect(strip([], 300, -300).tone).toBe("advance")
  })
})
