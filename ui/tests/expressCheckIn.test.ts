import { describe, expect, it } from "vitest"
import { checkInProblems, isCleanRoom, type CheckInForm } from "@custom/expressCheckIn"

const ok: CheckInForm = { name: "A Guest", idOnFile: false, idType: "Aadhaar", idNumber: "1234", hasRoom: true, pickedRoom: "", signed: true }

describe("checkInProblems", () => {
  it("asks for nothing more when name, ID, room and signature are there", () => expect(checkInProblems(ok)).toEqual([]))
  it("wants an ID unless one is on file", () => {
    expect(checkInProblems({ ...ok, idNumber: "" }).map((p) => p.page)).toEqual([1])
    expect(checkInProblems({ ...ok, idNumber: "", idOnFile: true })).toEqual([])
  })
  it("wants both the ID type and the number", () => expect(checkInProblems({ ...ok, idType: "" })).toHaveLength(1))
  it("wants a room, from the booking or picked", () => {
    expect(checkInProblems({ ...ok, hasRoom: false })).toHaveLength(1)
    expect(checkInProblems({ ...ok, hasRoom: false, pickedRoom: "R-201" })).toEqual([])
  })
  it("wants a signature, on screen, on paper or earlier", () => {
    expect(checkInProblems({ ...ok, signed: false })).toEqual([{ page: 2, message: "The guest must sign." }])
  })
  it("wants a name", () => expect(checkInProblems({ ...ok, name: "  " })).toHaveLength(1))
  it("lists several problems together", () => expect(checkInProblems({ ...ok, idNumber: "", hasRoom: false, signed: false })).toHaveLength(3))
})

describe("isCleanRoom", () => {
  it("accepts clean, inspected and ready", () => ["Clean", "Inspected", "Ready"].forEach((s) => expect(isCleanRoom(s)).toBe(true)))
  it("refuses the rest", () => ["Dirty", "Out of Order", "", null, undefined].forEach((s) => expect(isCleanRoom(s)).toBe(false)))
})
