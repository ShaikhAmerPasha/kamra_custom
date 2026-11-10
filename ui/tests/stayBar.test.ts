import { describe, expect, it } from "vitest"
import { stayChecklist, stayNext } from "../overlay/src/custom/stayBar"

describe("stay bar", () => {
  const base = { status: "Confirmed", room: null, idMissing: true, paid: 0, due: 3675 }
  it("lists what is missing before check-in", () => {
    const l = stayChecklist(base)
    expect(l.map((i) => [i.key, i.ok])).toEqual([["room", false], ["id", false], ["money", false]])
  })
  it("marks all ready", () => {
    expect(stayChecklist({ ...base, room: "201", idMissing: false, paid: 3675, due: 0 }).every((i) => i.ok)).toBe(true)
  })
  it("drops the room item once in house, and shows nothing when over", () => {
    expect(stayChecklist({ ...base, status: "Checked In" }).map((i) => i.key)).toEqual(["id", "money"])
    expect(stayChecklist({ ...base, status: "Checked Out" })).toEqual([])
    expect(stayChecklist({ ...base, status: "Cancelled" })).toEqual([])
  })
  it("offers check in from the arrival day, check out while in house", () => {
    expect(stayNext({ status: "Confirmed", checkIn: "2026-11-10", today: "2026-11-10", canCheckOut: false })).toBe("checkin")
    expect(stayNext({ status: "Confirmed", checkIn: "2026-11-21", today: "2026-11-10", canCheckOut: false })).toBe("")
    expect(stayNext({ status: "Checked In", checkIn: "2026-11-10", today: "2026-11-10", canCheckOut: true })).toBe("checkout")
    expect(stayNext({ status: "Checked In", checkIn: "2026-11-10", today: "2026-11-10", canCheckOut: false })).toBe("")
  })
})
