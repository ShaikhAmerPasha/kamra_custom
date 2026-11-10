import { describe, expect, it } from "vitest"
import { NO_TIMES, clock12, stayTimeArgs } from "../overlay/src/custom/stayTimes"

describe("stay times", () => {
  it("sends nothing when both are blank", () => {
    expect(stayTimeArgs(NO_TIMES)).toEqual({})
  })
  it("sends only the time that was set", () => {
    expect(stayTimeArgs({ arrive: "09:00", depart: "" })).toEqual({ check_in_time: "09:00" })
    expect(stayTimeArgs({ arrive: "09:00", depart: "14:00" })).toEqual({ check_in_time: "09:00", check_out_time: "14:00" })
  })
  it("reads the clock the way staff say it", () => {
    expect(clock12("09:00")).toBe("9:00 AM")
    expect(clock12("14:30")).toBe("2:30 PM")
    expect(clock12("00:05")).toBe("12:05 AM")
    expect(clock12("12:00")).toBe("12:00 PM")
    expect(clock12("")).toBe("")
  })
})
