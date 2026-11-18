import { describe, expect, it } from "vitest"
import { deskFlags, isOverdue, roomProblem, timeLabel, type DeskRoom, type DeskRow } from "../overlay/src/custom/deskRows"

const room = (hk: string, occ = "Vacant"): DeskRoom => ({ name: "R1", housekeeping_status: hk, occupancy_status: occ })
const today = "2026-11-18"
const base: DeskRow = { status: "Confirmed", room: "R1", check_out_date: "2026-11-19" }

describe("desk rows", () => {
  it("names a room that cannot take a guest", () => {
    expect(roomProblem(room("Clean"))).toBe("")
    expect(roomProblem(room("Dirty"))).toBe("Dirty")
    expect(roomProblem(room("Out of Order"))).toBe("Out of order")
    expect(roomProblem(room("Clean", "Occupied"))).toBe("Occupied")
    expect(roomProblem(undefined)).toBe("")
  })
  it("flags an arrival into a dirty room, and one with no room", () => {
    expect(deskFlags(base, { R1: room("Dirty") }, "arrivals", today, "10:00").map((f) => f.key)).toContain("room")
    expect(deskFlags({ ...base, room: null }, {}, "arrivals", today, "10:00").map((f) => f.key)).toContain("noroom")
    expect(deskFlags(base, { R1: room("Clean") }, "arrivals", today, "10:00")).toEqual([])
  })
  it("does not flag the room on the in-house tab", () => {
    const f = deskFlags({ ...base, status: "Checked In" }, { R1: room("Dirty") }, "in-house", today, "10:00")
    expect(f.map((x) => x.key)).not.toContain("room")
  })
  it("is overdue after the planned time on the day, or any later day, only when checked in", () => {
    const stay = { ...base, status: "Checked In", check_out_date: today, planned_check_out_time: "11:00" }
    expect(isOverdue(stay, today, "10:59")).toBe(false)
    expect(isOverdue(stay, today, "11:01")).toBe(true)
    expect(isOverdue({ ...stay, check_out_date: "2026-11-17" }, today, "08:00")).toBe(true)
    expect(isOverdue({ ...stay, status: "Confirmed" }, today, "23:00")).toBe(false)
    expect(isOverdue({ ...stay, planned_check_out_time: null }, today, "12:01")).toBe(true)
  })
  it("flags ID missing, VIP and requests", () => {
    const keys = deskFlags({ ...base, id_missing: true, vip: 1, special_requests: " late arrival " }, {}, "in-house", today, "10:00").map((f) => f.key)
    expect(keys).toEqual(["id", "vip", "req"])
    expect(deskFlags({ ...base, special_requests: "   " }, {}, "in-house", today, "10:00")).toEqual([])
  })
  it("picks the time for the tab", () => {
    expect(timeLabel({ ...base, planned_check_in_time: "15:30", eta: "14:00" }, "arrivals")).toBe("15:30")
    expect(timeLabel({ ...base, eta: "14:00" }, "arrivals")).toBe("14:00")
    expect(timeLabel({ ...base, planned_check_out_time: "11:00" }, "departures")).toBe("11:00")
    expect(timeLabel(base, "in-house")).toBe("")
  })
})
