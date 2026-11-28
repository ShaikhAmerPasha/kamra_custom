import { describe, expect, it } from "vitest"
import { hkCleaned, hkCounts, hkLabel } from "../overlay/src/custom/roomStatus"

describe("hkLabel", () => {
  it("shows Ready as Inspected and leaves the others", () => {
    expect(hkLabel("Ready")).toBe("Inspected")
    expect(hkLabel("Clean")).toBe("Clean")
    expect(hkLabel("Out of Order")).toBe("Out of Order")
    expect(hkLabel(null)).toBe("")
  })
})

describe("hkCleaned", () => {
  it("is true for Clean, Inspected and Ready only", () => {
    for (const s of ["Clean", "Inspected", "Ready"]) expect(hkCleaned(s)).toBe(true)
    for (const s of ["Dirty", "Out of Order", "", null, undefined]) expect(hkCleaned(s)).toBe(false)
  })
})

describe("hkCounts", () => {
  it("folds Ready into Inspected without changing the input", () => {
    const input = { Clean: 27, Ready: 3, Inspected: 1 }
    expect(hkCounts(input)).toEqual({ Clean: 27, Inspected: 4 })
    expect(input.Ready).toBe(3)
  })
  it("copes with nothing", () => {
    expect(hkCounts(undefined)).toEqual({})
    expect(hkCounts({ Dirty: 2 })).toEqual({ Dirty: 2 })
  })
})
