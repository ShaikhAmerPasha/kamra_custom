import { describe, expect, it } from "vitest"
import {
  EMPTY_FILTERS, SEARCH_STATUSES, marks, nameIsShort, searchArgs, withShortcut, withStatus,
} from "../overlay/src/custom/reservationSearch"

describe("reservation search", () => {
  it("offers MyCloud's eight status choices, Reserved first", () => {
    expect(SEARCH_STATUSES.map((s) => s[0])).toEqual(["reserved", "hold", "in_house", "checked_out", "cancelled", "no_show", "waitlisted", "all"])
  })

  it("leaves blank filters out of the call", () => {
    expect(searchArgs("P", EMPTY_FILTERS)).toEqual({ property: "P", status: "reserved", sort_by: "name", descending: 0 })
  })

  it("sends what was typed, trimmed, with the date side only when a date is set", () => {
    const a = searchArgs("P", { ...EMPTY_FILTERS, name: " Rekha ", phone: "9000", date: "2026-11-20", date_in: "departure", include_accompanying: true, descending: true })
    expect(a).toMatchObject({ name: "Rekha", phone: "9000", date: "2026-11-20", date_in: "departure", include_accompanying: 1, descending: 1 })
    expect(searchArgs("P", EMPTY_FILTERS)).not.toHaveProperty("date_in")
  })

  it("a shortcut sets the status it implies, and a status choice drops the shortcut", () => {
    expect(withShortcut(EMPTY_FILTERS, "no_shows_3_days")).toMatchObject({ shortcut: "no_shows_3_days", status: "no_show" })
    expect(withShortcut(EMPTY_FILTERS, "arrivals_today")).toMatchObject({ status: "reserved" })
    expect(withShortcut(EMPTY_FILTERS, "multi_room")).toMatchObject({ status: "all" })
    expect(withStatus(withShortcut(EMPTY_FILTERS, "arrivals_today"), "in_house")).toMatchObject({ shortcut: "", status: "in_house" })
    expect(withShortcut({ ...EMPTY_FILTERS, status: "hold" }, "")).toMatchObject({ shortcut: "", status: "hold" })
  })

  it("warns about a name shorter than 3 letters, not an empty one", () => {
    expect(nameIsShort({ ...EMPTY_FILTERS, name: "Re" })).toBe(true)
    expect(nameIsShort({ ...EMPTY_FILTERS, name: "Rek" })).toBe(false)
    expect(nameIsShort(EMPTY_FILTERS)).toBe(false)
  })

  it("marks leader before group, and repeater and companions apart", () => {
    expect(marks({ is_leader: true, group_booking: "G" })).toEqual(["leader"])
    expect(marks({ group_booking: "G", repeater: true, travels_with_others: true })).toEqual(["group", "repeater", "others"])
    expect(marks({})).toEqual([])
  })
})
