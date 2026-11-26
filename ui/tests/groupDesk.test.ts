import { describe, expect, it } from "vitest"
import { EMPTY_SEND, isOpen, pickupLine, roomLine, roomsTold, sendProblem, sendValues } from "../overlay/src/custom/groupDesk"

describe("sending master fields down", () => {
  it("sends only the ticked fields", () => {
    const f = { ...EMPTY_SEND, pay_by: "Company", gst_number: " 33abcde1234f1z5", market_segment: "Corporate", special_guest: true }
    expect(sendValues({ pay_by: true, gst_number: true, market_segment: true }, f)).toEqual({
      pay_by: "Company", gst_number: "33ABCDE1234F1Z5", market_segment: "Corporate",
    })
    expect(sendValues({}, f)).toEqual({})
  })

  it("a ticked blank clears the field on the rooms", () => {
    expect(sendValues({ gst_number: true, special_guest: true, credit_limit: true }, EMPTY_SEND)).toEqual({ gst_number: "", special_guest: 0, credit_limit: 0 })
  })

  it("sends the request text trimmed", () => {
    expect(sendValues({ special_requests: true }, { ...EMPTY_SEND, special_requests: "  Quiet floor " })).toEqual({ special_requests: "Quiet floor" })
  })

  it("judges only what is ticked", () => {
    const bad = { ...EMPTY_SEND, gst_number: "123", pan_number: "ABCDE1234F" }
    expect(sendProblem({ pan_number: true }, bad)).toBe("")
    expect(sendProblem({ gst_number: true }, bad)).toMatch(/GST/)
    expect(sendProblem({}, bad)).toBe("")
  })
})

describe("telling Kamra's group answers", () => {
  it("one line per room", () => {
    expect(roomLine({ reservation: "R", error: "No free room" })).toEqual({ ok: false, text: "No free room" })
    expect(roomLine({ reservation: "R", skipped: "No free room of this type" })).toEqual({ ok: false, text: "No free room of this type" })
    expect(roomLine({ reservation: "R", assigned: 1, room_number: "201" })).toEqual({ ok: true, text: "Room 201" })
    expect(roomLine({ reservation: "R", unchanged: 1 })).toEqual({ ok: true, text: "No change" })
    expect(roomLine({ reservation: "R", done: 1 })).toEqual({ ok: true, text: "Done" })
  })

  it("one sentence for all of them", () => {
    expect(roomsTold([{ reservation: "A", done: 1 }, { reservation: "B", done: 1 }])).toBe("All 2 done.")
    expect(roomsTold([{ reservation: "A", done: 1 }, { reservation: "B", error: "x" }])).toBe("1 done, 1 not done. See the reasons below.")
  })

  it("reads a block line and which rooms are open", () => {
    expect(pickupLine({ room_type: "T", room_type_name: "Deluxe", rooms_blocked: 10, picked_up: 6, remaining: 4 })).toBe("Deluxe: 10 blocked, 6 taken, 4 left")
    expect(isOpen("Confirmed")).toBe(true)
    expect(isOpen("Cancelled")).toBe(false)
    expect(isOpen("Checked Out")).toBe(false)
  })
})
