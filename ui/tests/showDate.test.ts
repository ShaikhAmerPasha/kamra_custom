import { describe, expect, it } from "vitest"
import { showMoment, showDate, showStay } from "../overlay/src/custom/showDate"

describe("showDate", () => {
  it("reads an ISO day as day, short month, year", () => {
    expect(showDate("2026-11-18", "en-GB")).toBe("18 Nov 2026")
    expect(showDate("2026-01-05T10:00:00", "en-GB")).toBe("5 Jan 2026")
  })
  it("does not shift the day with the time zone", () => {
    expect(showDate("2026-12-31", "en-GB")).toBe("31 Dec 2026")
  })
  it("gives back what it cannot read, and nothing for nothing", () => {
    expect(showDate("soon")).toBe("soon")
    expect(showDate("")).toBe("")
    expect(showDate(null)).toBe("")
  })
  it("shows a stay", () => {
    expect(showStay("2026-11-18", "2026-11-20", "en-GB")).toBe("18 Nov 2026 → 20 Nov 2026")
  })
})

describe("showMoment", () => {
  it("shows a date and a time to the minute", () => {
    expect(showMoment("2026-11-24 16:18:05.123")).toBe("24 Nov 2026 16:18")
    expect(showMoment("2026-11-24T08:05")).toBe("24 Nov 2026 08:05")
  })
  it("shows a plain date as a date and nothing as nothing", () => {
    expect(showMoment("2026-11-24")).toBe("24 Nov 2026")
    expect(showMoment(null)).toBe("")
  })
})
