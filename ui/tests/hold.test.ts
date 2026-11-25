import { describe, expect, it } from "vitest"
import { copyInitial, holdArgs, holdUntil } from "../overlay/src/custom/hold"

const now = new Date(2026, 10, 25, 10, 30) // 25 Nov 2026, 10:30

describe("hold", () => {
  it("counts hours from now", () => {
    expect(holdUntil(now, "6", "2026-12-01")).toBe("2026-11-25 16:30:00")
    expect(holdUntil(now, "24", "2026-12-01")).toBe("2026-11-26 10:30:00")
    expect(holdUntil(now, "48", "2026-12-01")).toBe("2026-11-27 10:30:00")
  })

  it("an unknown choice holds for a day", () => {
    expect(holdUntil(now, "x", "2026-12-01")).toBe("2026-11-26 10:30:00")
  })

  it("until the arrival day is 6 pm, and never already over", () => {
    expect(holdUntil(now, "arrival", "2026-11-28")).toBe("2026-11-28 18:00:00")
    expect(holdUntil(now, "arrival", "2026-11-25")).toBe("2026-11-25 18:00:00")
    expect(holdUntil(new Date(2026, 10, 25, 19, 0), "arrival", "2026-11-25")).toBe("2026-11-25 20:00:00")
  })

  it("makes a booking a Held one", () => {
    expect(holdArgs(now, "24", "2026-12-01")).toEqual({ status: "Held", hold_expires_on: "2026-11-26 10:30:00" })
  })
})

describe("copy", () => {
  const src = { guest: "G-1", guest_name: "Asha", phone: "9000012345", room_type: "RT", check_in_date: "2026-11-20", check_out_date: "2026-11-23", adults: 2, children: 1 }

  it("keeps the guest, room type, party and length of stay", () => {
    expect(copyInitial(src, "2026-11-01")).toEqual({
      guest: "G-1", guest_name: "Asha", phone: "9000012345", room_type: "RT", date: "2026-11-20", stays: 3, adults: 2, children: 1,
    })
  })

  it("moves past dates to today, and always keeps at least one night", () => {
    expect(copyInitial(src, "2026-11-25").date).toBe("2026-11-25")
    expect(copyInitial({ ...src, check_out_date: "2026-11-20" }, "2026-11-01").stays).toBe(1)
    expect(copyInitial({ ...src, guest: null, phone: null }, "2026-11-01")).toMatchObject({ guest: undefined, phone: undefined })
  })
})
