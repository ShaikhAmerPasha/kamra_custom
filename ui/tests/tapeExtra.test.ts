import { describe, expect, it } from "vitest"
import { addDay, barSpan, isOverdue, mergeExtras, overdueWords, packLanes, type ExtraData, type ExtraStay } from "../overlay/src/custom/tapeExtra"

const stay = (name: string, ci: string, co: string, room: string | null = null): ExtraStay => ({
  name, room, status: "Confirmed", check_in_date: ci, check_out_date: co,
})
const chart = (): ExtraData => ({
  start: "2026-11-27",
  rooms: [
    { name: "R201", room_number: "201", room_type: "DLX", housekeeping_status: "Clean", bookings: [] },
    { name: "R202", room_number: "202", room_type: "DLX", housekeeping_status: "Clean", bookings: [stay("A", "2026-11-27", "2026-11-28", "R202")] },
  ],
})

describe("packLanes", () => {
  it("puts overlapping stays on separate lines and back-to-back stays on one", () => {
    const lanes = packLanes([stay("a", "2026-11-27", "2026-11-30"), stay("b", "2026-11-28", "2026-11-29"), stay("c", "2026-11-30", "2026-12-01")])
    expect(lanes.map((l) => l.map((s) => s.name))).toEqual([["a", "c"], ["b"]])
  })
  it("is empty for none", () => expect(packLanes([])).toEqual([]))
})

describe("mergeExtras", () => {
  it("returns the same data when there is nothing to add", () => {
    const d = chart()
    expect(mergeExtras(d, { today: "2026-11-27", overdue: [], unassigned: [] }, 14)).toBe(d)
    expect(mergeExtras(d, null, 14)).toBe(d)
  })
  it("puts an overdue guest on their room, on today, flagged", () => {
    const out = mergeExtras(chart(), { today: "2026-11-27", unassigned: [], overdue: [{ ...stay("O", "2026-11-24", "2026-11-25", "R201"), status: "Checked In" }] }, 14)
    const bars = out.rooms[0].bookings
    expect(bars).toHaveLength(1)
    expect(isOverdue(bars[0])).toBe(true)
    expect(barSpan(bars[0] as never)).toEqual({ inDate: "2026-11-27", outDate: "2026-11-29" })
    expect(bars[0].check_out_date).toBe("2026-11-25") // the real dates stay for the panel
  })
  it("leaves the other rooms alone", () => {
    const out = mergeExtras(chart(), { today: "2026-11-27", unassigned: [], overdue: [{ ...stay("O", "2026-11-24", "2026-11-25", "R201"), status: "Checked In" }] }, 14)
    expect(out.rooms[1].bookings.map((b) => b.name)).toEqual(["A"])
  })
  it("does not draw overdue bars when today is off screen", () => {
    const d = { ...chart(), start: "2026-12-20" }
    expect(mergeExtras(d, { today: "2026-11-27", unassigned: [], overdue: [stay("O", "2026-11-24", "2026-11-25", "R201")] }, 14)).toBe(d)
  })
  it("ignores an overdue guest whose room is not on the chart", () => {
    const out = mergeExtras(chart(), { today: "2026-11-27", unassigned: [], overdue: [stay("O", "2026-11-24", "2026-11-25", "GONE")] }, 14)
    expect(out.rooms.flatMap((r) => r.bookings).map((b) => b.name)).toEqual(["A"])
  })
  it("adds waiting lines on top, one per overlap", () => {
    const out = mergeExtras(chart(), { today: "2026-11-27", overdue: [], unassigned: [stay("u1", "2026-11-27", "2026-11-30"), stay("u2", "2026-11-27", "2026-11-30")] }, 14)
    expect(out.rooms.slice(0, 2).map((r) => r.name)).toEqual(["__waiting_1", "__waiting_2"])
    expect(out.rooms[0].bookings[0].room).toBe("__waiting_1")
    expect(out.rooms).toHaveLength(4)
  })
})

describe("dates", () => {
  it("adds days across a month end", () => expect(addDay("2026-11-30", 1)).toBe("2026-12-01"))
  it("says how late", () => {
    expect(overdueWords("2026-11-26", "2026-11-27")).toBe("1 day overdue")
    expect(overdueWords("2026-11-24", "2026-11-27")).toBe("3 days overdue")
  })
})
