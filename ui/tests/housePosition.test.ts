import { describe, expect, it } from "vitest"
import { housePosition } from "../overlay/src/custom/housePosition"

describe("house position", () => {
  it("reads rooms and movement from the dashboard figures", () => {
    const p = housePosition({
      arrivals: 3,
      departures: 2,
      in_house: 7,
      no_shows: 1,
      housekeeping: { room_status: { Clean: 10, Dirty: 4, Inspected: 2, "Out of Order": 1 }, occupied: 7 },
      occupancy_now: { occupied: 7, sellable: 29 },
    })
    expect(p.occupied).toBe(7)
    expect(p.sellable).toBe(29)
    expect(p.pct).toBe(24.1)
    expect(p.rooms.find((r) => r.label === "Out of order")?.count).toBe(1)
    expect(p.today.map((r) => r.count)).toEqual([3, 7, 2, 1])
  })
  it("shows zeros, never NaN, before the data arrives or with no rooms", () => {
    for (const d of [null, undefined, {}, { occupancy_now: { occupied: 0, sellable: 0 } }]) {
      const p = housePosition(d)
      expect(p.pct).toBe(0)
      expect(p.rooms.every((r) => r.count === 0)).toBe(true)
    }
  })
})
