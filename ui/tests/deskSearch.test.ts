import { describe, expect, it } from "vitest"
import { contactLine, filterRows, matchesRow, type SearchRow } from "../overlay/src/custom/deskSearch"

const r = (o: Partial<SearchRow> = {}): SearchRow => ({
  name: "RES-2026-00037", guest_name: "Maaz Khan", room: "SR Continental-401", phone: "+91 78787 87878", company_name: "Bharat Tech Solutions", ...o,
})

describe("matchesRow", () => {
  it("matches everything for an empty query", () => expect(matchesRow(r(), "  ")).toBe(true))
  it("matches name, company, booking number and room number", () => {
    for (const q of ["maaz", "BHARAT", "00037", "401"]) expect(matchesRow(r(), q)).toBe(true)
  })
  it("matches a phone by its digits, whatever the spacing", () => {
    expect(matchesRow(r(), "78787")).toBe(true)
    expect(matchesRow(r(), "+91 787 878")).toBe(true)
  })
  it("does not match a few stray digits against the phone", () => expect(matchesRow(r({ phone: "+91 98111 22334" }), "78")).toBe(false))
  it("does not match something else", () => expect(matchesRow(r(), "zzz")).toBe(false))
  it("copes with missing phone, company and room", () => {
    expect(matchesRow(r({ phone: null, company_name: undefined, room: null }), "maaz")).toBe(true)
  })
})

describe("filterRows", () => {
  it("keeps the list as it is without a query and filters with one", () => {
    const rows = [r(), r({ name: "B", guest_name: "Asha" })]
    expect(filterRows(rows, "")).toBe(rows)
    expect(filterRows(rows, "asha").map((x) => x.name)).toEqual(["B"])
  })
})

describe("contactLine", () => {
  it("joins what is known", () => {
    expect(contactLine({ phone: "+91 9", company_name: "ACME" })).toBe("+91 9 · ACME")
    expect(contactLine({ phone: "", company_name: "ACME" })).toBe("ACME")
    expect(contactLine({})).toBe("")
  })
})
