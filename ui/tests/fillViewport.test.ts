import { describe, expect, it } from "vitest"
import { fillHeight } from "../overlay/src/custom/fillHeight"

describe("fill the viewport", () => {
  it("takes what is left under the page top, less the bottom strip", () => {
    expect(fillHeight(1025, 110, 44)).toBe(871)
  })
  it("never goes below a usable height", () => {
    expect(fillHeight(300, 200, 44)).toBe(240)
  })
  it("is a whole number of pixels", () => {
    expect(Number.isInteger(fillHeight(1000.7, 110.4, 44))).toBe(true)
  })
})
