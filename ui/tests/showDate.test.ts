import { describe, expect, it } from "vitest"
import { showDate, showStay } from "../overlay/src/custom/showDate"

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
