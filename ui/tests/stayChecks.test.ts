import { describe, expect, it } from "vitest"
import { checkInItems, checkOutItems } from "../overlay/src/custom/stayChecks"

const f = (balance: number, over = {}) => ({ side: "guest", status: "Open", has_charges: true, balance, ...over })

describe("stay checks", () => {
  it("check-out: settled bill, no open folios, ID on file", () => {
    const items = checkOutItems({ due: 0, folios: [f(0)], idMissing: false })
    expect(items.map((x) => x.key)).toEqual(["bill", "id"])
    expect(items.every((x) => x.ok)).toBe(true)
  })
  it("check-out: the guest's own open bill is not listed twice", () => {
    expect(checkOutItems({ due: 300, folios: [f(300)], idMissing: false }).map((x) => x.key)).toEqual(["bill", "id"])
  })
  it("check-out: counts folios still holding a balance, never the group folio", () => {
    const items = checkOutItems({ due: 500, folios: [f(300), f(200), f(900, { side: "group" }), f(0)], idMissing: true })
    expect(items.find((x) => x.key === "bill")).toMatchObject({ ok: false, amount: 500 })
    expect(items.find((x) => x.key === "folios")).toMatchObject({ ok: false, count: 2 })
    expect(items.find((x) => x.key === "id")?.ok).toBe(false)
  })
  it("check-out: a closed folio does not count", () => {
    const items = checkOutItems({ due: 0, folios: [f(200, { status: "Closed" }), f(100, { status: "Closed" })], idMissing: false })
    expect(items.map((x) => x.key)).toEqual(["bill", "id"])
  })
  it("check-in: shows the balance and what was paid already", () => {
    const items = checkInItems({ due: 6090, paid: 0, idMissing: true })
    expect(items.find((x) => x.key === "balance")).toMatchObject({ ok: false, amount: 6090 })
    expect(items.find((x) => x.key === "deposit")).toMatchObject({ ok: false, amount: 0 })
    expect(checkInItems({ due: 0, paid: 2000, idMissing: false }).every((x) => x.ok)).toBe(true)
  })
  it("never shows a negative amount", () => {
    expect(checkInItems({ due: -300, paid: 300, idMissing: false })[0].amount).toBe(0)
  })
})
