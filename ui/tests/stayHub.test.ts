import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { unpostedAmount, daysBetween, folioTitle, hubChips, occupantLine, openStayHub, stamp, HUB_EVENT, type StripInput } from "../overlay/src/custom/stayHub"

const base: StripInput = {
  status: "Checked In", due: 0, idOnFile: true, depositPaid: 0, roomStatus: "Clean",
  checkIn: "2026-11-18", checkOut: "2026-11-23", today: "2026-11-20", money: (n) => `₹${n}`,
}
const keys = (i: Partial<StripInput>) => hubChips({ ...base, ...i }).map((c) => c.key)
const chip = (i: Partial<StripInput>, key: string) => hubChips({ ...base, ...i }).find((c) => c.key === key)

describe("daysBetween", () => {
  it("counts days", () => expect(daysBetween("2026-11-20", "2026-11-23")).toBe(3))
  it("is negative backwards", () => expect(daysBetween("2026-11-20", "2026-11-18")).toBe(-2))
  it("ignores a time part", () => expect(daysBetween("2026-11-20 10:00:00", "2026-11-21")).toBe(1))
})

describe("hubChips", () => {
  it("shows money owed first, in red", () => {
    const c = chip({ due: 21000 }, "owed")!
    expect(c.tone).toBe("bad")
    expect(c.vars).toEqual({ amount: "₹21000" })
  })
  it("says settled for an in-house bill with nothing owed", () => expect(chip({}, "owed")?.label).toBe("Bill settled"))
  it("says nothing about money for a booking with no bill yet", () => expect(chip({ status: "Confirmed" }, "owed")).toBeUndefined())
  it("flags a missing ID", () => expect(chip({ idOnFile: false }, "id")?.tone).toBe("warn"))
  it("hides the ID chip once the stay has ended", () => expect(keys({ status: "Checked Out" })).not.toContain("id"))
  it("shows a received deposit", () => expect(chip({ depositPaid: 6000 }, "deposit")?.vars).toEqual({ amount: "₹6000" }))
  it("warns about a dirty room, rejects an out-of-order one", () => {
    expect(chip({ roomStatus: "Dirty" }, "room")?.tone).toBe("warn")
    expect(chip({ roomStatus: "Out of Order" }, "room")?.tone).toBe("bad")
    expect(chip({ roomStatus: "Clean" }, "room")?.tone).toBe("plain")
  })
  it("says when an in-house guest leaves", () => {
    expect(chip({}, "when")?.vars).toEqual({ n: 3 })
    expect(chip({ checkOut: "2026-11-20" }, "when")?.label).toBe("Leaves today")
    expect(chip({ checkOut: "2026-11-21" }, "when")?.label).toBe("Leaves in {n} day")
    expect(chip({ checkOut: "2026-11-19" }, "when")?.tone).toBe("bad")
  })
  it("says when an arrival is due", () => {
    expect(chip({ status: "Confirmed", checkIn: "2026-11-20" }, "when")?.label).toBe("Arrives today")
    expect(chip({ status: "Confirmed", checkIn: "2026-11-24" }, "when")?.vars).toEqual({ n: 4 })
    expect(chip({ status: "Confirmed", checkIn: "2026-11-19" }, "when")?.label).toBe("Arrival missed")
  })
})

describe("stamp, titles, occupants", () => {
  it("shortens a server stamp", () => expect(stamp("2026-11-20 10:27:41")).toBe("20 Nov 10:27"))
  it("titles a bill by its side", () => expect(folioTitle({ side: "Company", folio: "F-1" })).toBe("Company bill · F-1"))
  it("lists an occupant with arrival and departure", () => {
    expect(occupantLine({ full_name: "A", arrived_at: "2026-11-20 10:00", left_at: null })).toBe("A · arrived 20 Nov 10:00")
  })
})

describe("openStayHub", () => {
  // the tests run without a browser: give them a window that can carry events
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it("fires the event with the booking and the tab", () => {
    const seen: unknown[] = []
    const on = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(HUB_EVENT, on)
    openStayHub("RES-1", "money")
    window.removeEventListener(HUB_EVENT, on)
    expect(seen).toEqual([{ reservation: "RES-1", tab: "money" }])
  })
  it("does nothing without a booking", () => {
    const fn = vi.fn()
    window.addEventListener(HUB_EVENT, fn)
    openStayHub("")
    window.removeEventListener(HUB_EVENT, fn)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("unpostedAmount", () => {
  it("is the nights not posted yet", () => {
    expect(unpostedAmount(5041, [{ side: "Guest", balance: 2416 }])).toBe(2625)
  })
  it("is zero when the strip and the bill agree", () => {
    expect(unpostedAmount(2416, [{ side: "Guest", balance: 2416 }])).toBe(0)
  })
  it("counts only the guest's bills", () => {
    expect(unpostedAmount(100, [{ side: "Guest", balance: 100 }, { side: "Company", balance: 900 }])).toBe(0)
  })
  it("is never negative", () => {
    expect(unpostedAmount(50, [{ side: "Guest", balance: 100 }])).toBe(0)
  })
})
