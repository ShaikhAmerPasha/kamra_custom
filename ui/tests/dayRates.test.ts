import { describe, expect, it } from "vitest"
import {
  copyToAll, copyToFollowing, discountByAmount, discountByPercent, percentBelow, resetToSystem, systemNightly, toNumber,
} from "../overlay/src/custom/dayRates"

describe("system price per night", () => {
  it("adds the meal to each night's room rate", () => {
    expect(systemNightly({ entry_rates: [3500, 3800], meal_per_night: 400 })).toEqual([3900, 4200])
    expect(systemNightly({ entry_rates: [3500] })).toEqual([3500])
  })

  it("says nothing when it cannot be compared with what is typed", () => {
    expect(systemNightly(undefined)).toBeNull()
    expect(systemNightly({ entry_rates: [] })).toBeNull()
    expect(systemNightly({ entry_rates: [3500], inclusive: true })).toBeNull()
  })
})

describe("discounts", () => {
  const system = [4000, 4500, 5000]

  it("by percent, rounded to paise", () => {
    expect(discountByPercent(system, 10)).toEqual(["3600", "4050", "4500"])
    expect(discountByPercent([3333], 12.5)).toEqual(["2916.38"])
    expect(discountByPercent(system, 0)).toEqual(["4000", "4500", "5000"])
    expect(discountByPercent(system, 100)).toEqual(["0", "0", "0"])
  })

  it("by amount a night, never below nothing", () => {
    expect(discountByAmount(system, 500)).toEqual(["3500", "4000", "4500"])
    expect(discountByAmount([300], 500)).toEqual(["0"])
  })

  it("refuses a discount that is not one", () => {
    for (const bad of [-1, 101, NaN, Infinity]) expect(discountByPercent(system, bad)).toBeNull()
    for (const bad of [-1, NaN]) expect(discountByAmount(system, bad)).toBeNull()
  })

  it("says how far below the system price a rate is", () => {
    expect(percentBelow(4000, 3600)).toBe(10)
    expect(percentBelow(4000, 4000)).toBe(0)
    expect(percentBelow(4000, 4500)).toBe(0)
    expect(percentBelow(0, 100)).toBe(0)
    expect(percentBelow(4000, NaN)).toBe(0)
  })
})

describe("copying and resetting", () => {
  it("copies one night to all nights, or to it and those after", () => {
    expect(copyToAll(["1", "2", "3"], 1)).toEqual(["2", "2", "2"])
    expect(copyToFollowing(["1", "2", "3", "4"], 1)).toEqual(["1", "2", "2", "2"])
    expect(copyToFollowing(["1", "2"], 5)).toEqual(["1", "2"].map((v) => v))
  })

  it("resets to the system price", () => {
    expect(resetToSystem([3900.5, 4200])).toEqual(["3900.5", "4200"])
  })

  it("reads typed numbers, blank as not a number", () => {
    expect(toNumber(" 12.5 ")).toBe(12.5)
    expect(toNumber("")).toBeNaN()
    expect(toNumber("abc")).toBeNaN()
  })
})
