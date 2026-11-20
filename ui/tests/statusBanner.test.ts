import { describe, expect, it } from "vitest"
import { statusBanner } from "../overlay/src/custom/stayDetails"

describe("statusBanner", () => {
  it("names each live state in capitals", () => {
    expect(statusBanner("Confirmed")).toEqual({ label: "CONFIRMED", tone: "blue" })
    expect(statusBanner("Checked In")).toEqual({ label: "IN HOUSE", tone: "green" })
    expect(statusBanner("Checked Out")).toEqual({ label: "CHECKED OUT", tone: "grey" })
  })
  it("marks a cancelled or missed stay in red", () => {
    expect(statusBanner("Cancelled").tone).toBe("red")
    expect(statusBanner("No Show").tone).toBe("red")
  })
  it("never fails on an unknown or missing status", () => {
    expect(statusBanner("Something").label).toBe("SOMETHING")
    expect(statusBanner(null).label).toBe("BOOKING")
  })
})
