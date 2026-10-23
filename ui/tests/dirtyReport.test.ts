import { describe, expect, it } from "vitest"
import { dateOf, dateTimeOf, downloadUrl, timeOf } from "@custom/dirtyReport"
import { formatElapsed } from "@custom/duration"

describe("dirty report helpers", () => {
  it("splits a server time into date and time", () => {
    expect(dateOf("2026-10-17 11:42:08.5")).toBe("2026-10-17")
    expect(timeOf("2026-10-17 11:42:08.5")).toBe("11:42")
    expect(dateTimeOf("2026-10-17 11:42:08.5")).toBe("2026-10-17 11:42")
  })
  it("is empty when the time is unknown", () => {
    expect(dateOf(null)).toBe("")
    expect(timeOf(null)).toBe("")
    expect(dateTimeOf(null)).toBe("")
  })
  it("downloads the Excel file for the property", () => {
    expect(downloadUrl("SR Continental")).toBe(
      "/api/method/kamra_custom.housekeeping.dirty_room_report_xlsx?property=SR%20Continental",
    )
  })
})

describe("formatElapsed", () => {
  it("formats minutes", () => {
    expect(formatElapsed(0)).toBe("0m")
    expect(formatElapsed(130)).toBe("2h 10m")
    expect(formatElapsed(120)).toBe("2h")
    expect(formatElapsed(26 * 60 + 5)).toBe("1d 2h")
    expect(formatElapsed(null)).toBe("-")
  })
})
