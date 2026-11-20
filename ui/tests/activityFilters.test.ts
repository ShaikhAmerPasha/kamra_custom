import { describe, expect, it } from "vitest"
import { activityCsv, anyFilter, dateProblem, emptyFilters, filterArgs, filtersFromUrl } from "../overlay/src/custom/activityFilters"

describe("filtersFromUrl", () => {
  it("pre-fills a record", () => {
    expect(filtersFromUrl("?record=RES-2026-00056").record).toBe("RES-2026-00056")
  })
  it("drops a date that is not a date", () => {
    expect(filtersFromUrl("?from=yesterday&to=2026-11-20")).toMatchObject({ from: "", to: "2026-11-20" })
  })
  it("is empty with no query", () => {
    expect(filtersFromUrl("")).toEqual(emptyFilters())
  })
})

describe("filterArgs", () => {
  it("leaves empty filters out", () => {
    expect(filterArgs(emptyFilters())).toEqual({})
    expect(anyFilter(emptyFilters())).toBe(false)
  })
  it("names the server arguments", () => {
    expect(filterArgs({ search: " cash ", from: "2026-11-01", to: "2026-11-20", record: "RES-1" })).toEqual({
      search: "cash", date_from: "2026-11-01", date_to: "2026-11-20", record: "RES-1",
    })
  })
})

describe("dateProblem", () => {
  it("flags a start after the end", () => {
    expect(dateProblem({ ...emptyFilters(), from: "2026-11-20", to: "2026-11-01" })).not.toBe("")
    expect(dateProblem({ ...emptyFilters(), from: "2026-11-01", to: "2026-11-20" })).toBe("")
  })
})

describe("activityCsv", () => {
  const row = { creation: "2026-11-20 10:31:00", actor: "ameer@x.org", action_type: "check_out", rationale: 'He said "hi", left', reference_name: "RES-1", approval_status: "Executed" }
  it("quotes cells and doubles inner quotes", () => {
    expect(activityCsv([row]).split("\r\n")[1]).toContain('"He said ""hi"", left"')
  })
  it("shows the user name, not the address", () => {
    expect(activityCsv([row])).toContain('"ameer"')
  })
  it("defuses a formula", () => {
    expect(activityCsv([{ ...row, rationale: "=HYPERLINK(1)" }])).toContain(`"'=HYPERLINK(1)"`)
  })
})
