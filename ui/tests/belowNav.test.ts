import { describe, expect, it } from "vitest"
import { belowNavTop, SHORTCUT_STRIP } from "../overlay/src/custom/belowNav"

describe("below the menu bar", () => {
  it("starts under the menu bar", () => expect(belowNavTop(110.4, 1000)).toBe(110))
  it("starts at the top when there is no menu bar", () => {
    expect(belowNavTop(null, 1000)).toBe(0)
    expect(belowNavTop(undefined, 1000)).toBe(0)
    expect(belowNavTop(NaN, 1000)).toBe(0)
  })
  it("a menu bar scrolled off the window means the top", () => expect(belowNavTop(-40, 1000)).toBe(0))
  it("never takes more than half the window", () => expect(belowNavTop(900, 1000)).toBe(500))
  it("leaves room for the shortcut strip", () => expect(SHORTCUT_STRIP).toBeGreaterThan(0))
})
