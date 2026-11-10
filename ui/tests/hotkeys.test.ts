import { describe, expect, it } from "vitest"
import { LABELS, SHORTCUTS, matchKey, pickButton } from "../overlay/src/custom/hotkeys"

const key = (k: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; code: string }> = {}) => ({
  key: k,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
})

describe("hotkeys", () => {
  it("F-keys fire, also while typing", () => {
    const m = matchKey(key("F4"), true, null)
    expect(m.kind === "hit" && m.shortcut.target).toBe("checkin")
    const f2 = matchKey(key("F2"), true, null)
    expect(f2.kind === "hit" && f2.shortcut.action).toBe("new-booking")
  })

  it("browser-owned F-keys are not taken", () => {
    for (const k of ["F5", "F6", "F11", "F12"]) expect(matchKey(key(k), false, null).kind).toBe("none")
  })

  it("Alt+letter fires while typing, and reads the physical key (Option on a Mac)", () => {
    const m = matchKey(key("n", { altKey: true }), true, null)
    expect(m.kind === "hit" && m.shortcut.action).toBe("new-booking")
    const mac = matchKey(key("˜", { altKey: true, code: "KeyN" }), true, null)
    expect(mac.kind === "hit" && mac.shortcut.action).toBe("new-booking")
  })

  it("plain keys do nothing while typing", () => {
    expect(matchKey(key("/"), true, null).kind).toBe("none")
    expect(matchKey(key("g"), true, null).kind).toBe("none")
  })

  it("g then r goes to the room board", () => {
    expect(matchKey(key("g"), false, null)).toEqual({ kind: "pending", first: "g" })
    const second = matchKey(key("r"), false, "g")
    expect(second.kind === "hit" && second.shortcut.to).toBe("/room-board")
  })

  it("an unknown second key cancels the chord", () => {
    expect(matchKey(key("z"), false, "g").kind).toBe("none")
  })

  it("Ctrl and Meta combos are left to the browser", () => {
    expect(matchKey(key("n", { ctrlKey: true }), false, null).kind).toBe("none")
    expect(matchKey(key("F4", { metaKey: true }), false, null).kind).toBe("none")
  })

  it("no two shortcuts share keys", () => {
    const ids = SHORTCUTS.map((s) => `${s.alt ? "alt+" : ""}${s.keys}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every click shortcut names a target, every go shortcut a route", () => {
    for (const s of SHORTCUTS) {
      if (s.action === "click") expect(LABELS[s.target!]).toBeDefined()
      if (s.action === "go") expect(s.to).toMatch(/^\//)
    }
  })

  it("label patterns match Kamra's button text", () => {
    expect(LABELS.checkin.test("Check in")).toBe(true)
    expect(LABELS.checkin.test("Check-in")).toBe(true)
    expect(LABELS.checkin.test("Check-in summary")).toBe(true)
    expect(LABELS.checkout.test("Check out")).toBe(true)
    expect(LABELS.checkout.test("Check-out")).toBe(true)
    expect(LABELS.payment.test("Record payment")).toBe(true)
    expect(LABELS.payment.test("Payment mode")).toBe(false)
    expect(LABELS.walkin.test("Walk-in")).toBe(true)
    expect(LABELS.print.test("Print bill")).toBe(true)
  })

  it("picks a button only when exactly one fits", () => {
    expect(pickButton(["Cancel", "Check in"], "checkin")).toBe(1)
    expect(pickButton(["Check in", "Check in"], "checkin")).toBe(-1)
    expect(pickButton(["Cancel"], "checkin")).toBe(-1)
  })
})

import { advancesOnEnter } from "../overlay/src/custom/hotkeys"

describe("Enter moves to the next field", () => {
  const f = (o: Partial<Parameters<typeof advancesOnEnter>[0]> = {}) =>
    advancesOnEnter({ tag: "INPUT", type: "text", picker: false, inForm: false, ...o })
  it("advances on plain inputs", () => {
    expect(f()).toBe(true)
    expect(f({ type: "number" })).toBe(true)
    expect(f({ type: "tel" })).toBe(true)
  })
  it("leaves pickers, forms, text areas, buttons and boxes alone", () => {
    expect(f({ picker: true })).toBe(false)
    expect(f({ inForm: true })).toBe(false)
    expect(f({ tag: "TEXTAREA" })).toBe(false)
    expect(f({ tag: "BUTTON" })).toBe(false)
    expect(f({ type: "checkbox" })).toBe(false)
  })
})

import { clickAction, normalizePath } from "../overlay/src/custom/usageNames"

describe("usage counter", () => {
  it("hides record names in paths", () => {
    expect(normalizePath("/billing/FOLIO-2026-01630")).toBe("/billing/:id")
    expect(normalizePath("/in-house?tab=arrivals")).toBe("/in-house")
    expect(normalizePath("/")).toBe("/")
    expect(normalizePath("/grc/RES-2026-00003")).toBe("/grc/:id")
  })
  it("names tracked buttons and ignores the rest", () => {
    expect(clickAction("Check in")).toBe("click:checkin")
    expect(clickAction("New booking")).toBe("click:new-booking")
    expect(clickAction("Collect ₹3,675.00 and check out")).toBe("")
    expect(clickAction("Ali Khan")).toBe("")
  })
})

import { isTileLabel, nextByDirection, type Rect } from "../overlay/src/custom/hotkeys"

describe("room tile arrows", () => {
  // two rows of three tiles
  const grid: Rect[] = [0, 1, 2, 3, 4, 5].map((i) => ({ left: (i % 3) * 100, top: Math.floor(i / 3) * 80, width: 90, height: 70 }))
  it("moves along the row and down the column", () => {
    expect(nextByDirection(grid, 0, "right")).toBe(1)
    expect(nextByDirection(grid, 1, "left")).toBe(0)
    expect(nextByDirection(grid, 1, "down")).toBe(4)
    expect(nextByDirection(grid, 4, "up")).toBe(1)
  })
  it("stops at the edge", () => {
    expect(nextByDirection(grid, 2, "right")).toBe(-1)
    expect(nextByDirection(grid, 0, "up")).toBe(-1)
  })
  it("goes to the next row when the row ends but a tile is below-left", () => {
    const short: Rect[] = [{ left: 0, top: 0, width: 90, height: 70 }, { left: 100, top: 0, width: 90, height: 70 }, { left: 0, top: 80, width: 90, height: 70 }]
    expect(nextByDirection(short, 1, "down")).toBe(2)
  })
  it("tells a room tile from other buttons", () => {
    expect(isTileLabel("101 Superior Premium CLEAN")).toBe(true)
    expect(isTileLabel("101Superior Premium Room")).toBe(true)
    expect(isTileLabel("Refresh")).toBe(false)
    expect(isTileLabel("All rooms 30")).toBe(false)
  })
})
