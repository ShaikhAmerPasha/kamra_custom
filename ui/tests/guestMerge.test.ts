import { describe, expect, it } from "vitest"
import { bookingsMoving, confirmText, reasonOk, toRemove, type DupGroup } from "../overlay/src/custom/guestMerge"

const m = (name: string, stays: number, phone = "") => ({ name, full_name: "ameer", phone, email: "", stays, last_stay: "", vip: 0, blacklisted: 0 })
const g: DupGroup = { members: [m("G-1", 2, "+91735"), m("G-2", 1)], keep: "G-1", can_merge: true, blocked: "" }

describe("guest merge", () => {
  it("removes every profile but the kept one", () => {
    expect(toRemove(g, "G-1").map((x) => x.name)).toEqual(["G-2"])
    expect(toRemove(g, "G-2").map((x) => x.name)).toEqual(["G-1"])
  })
  it("counts the bookings that move", () => {
    expect(bookingsMoving(g, "G-1")).toBe(1)
    expect(bookingsMoving(g, "G-2")).toBe(2)
  })
  it("says what happens and that it cannot be undone", () => {
    const t = confirmText(g, "G-1")
    expect(t).toContain("G-2 will be joined into G-1 (+91735)")
    expect(t).toContain("1 booking moves.")
    expect(t).toContain("cannot be undone")
  })
  it("says so when no booking moves", () => {
    expect(confirmText({ ...g, members: [m("G-1", 1), m("G-2", 0)] }, "G-1")).toContain("No bookings move.")
  })
  it("needs a reason of a few letters", () => {
    expect(reasonOk("  ")).toBe(false)
    expect(reasonOk("ab")).toBe(false)
    expect(reasonOk("typed twice")).toBe(true)
  })
})
