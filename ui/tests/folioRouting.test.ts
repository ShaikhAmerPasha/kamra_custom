import { describe, expect, it } from "vitest"
import { emptyRule, movedTold, ruleLine, rulesFromServer, rulesProblem, rulesToServer, routingSummary, sameRules } from "../overlay/src/custom/folioRouting"

const ctx = { hasCompany: false, inGroup: false }

describe("folio routing rules", () => {
  it("keeps only complete rows, blank dates as null", () => {
    expect(rulesToServer([{ ...emptyRule(), charge_type: "Room" }, emptyRule()])).toEqual([{ charge_type: "Room", target: "Extra", date_from: null, date_to: null }])
  })

  it("reads server rows with missing parts", () => {
    expect(rulesFromServer([{ charge_type: "Room", target: "Guest", date_from: null as unknown as string }])).toEqual([{ charge_type: "Room", target: "Guest", date_from: "", date_to: "" }])
  })

  it("a half-filled new row does not count as a change", () => {
    const saved = rulesFromServer([{ charge_type: "Room", target: "Extra" }])
    expect(sameRules(saved, [...saved, emptyRule()])).toBe(true)
    expect(sameRules(saved, [{ ...saved[0], target: "Guest" }])).toBe(false)
  })

  it("names the first problem like the server does", () => {
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room" }], ctx)).toBe("")
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room", date_from: "2026-12-05", date_to: "2026-12-01" }], ctx)).toMatch(/first date is after/)
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room" }, { ...emptyRule(), charge_type: "Room", target: "Guest" }], ctx)).toMatch(/two rules/)
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room", target: "Company" }], ctx)).toMatch(/company/)
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room", target: "Company" }], { ...ctx, hasCompany: true })).toBe("")
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room", target: "Group" }], ctx)).toMatch(/group/)
    expect(rulesProblem([{ ...emptyRule(), charge_type: "Room", target: "Group" }], { ...ctx, inGroup: true })).toBe("")
  })

  it("tells a rule and the summary in plain words", () => {
    expect(ruleLine({ charge_type: "Food & Beverage", target: "Extra", date_from: "2026-11-26", date_to: "2026-11-28" })).toBe("Food & Beverage → Folio #2 (extra), 26/11 to 28/11")
    expect(ruleLine({ charge_type: "Room", target: "Company", date_from: "", date_to: "" })).toBe("Room → Company folio")
    expect(routingSummary([], 0)).toBe("")
    expect(routingSummary([{ ...emptyRule(), charge_type: "Room" }], 0)).toBe("1 rule · all routed")
    expect(routingSummary([{ ...emptyRule(), charge_type: "Room" }, { ...emptyRule(), charge_type: "Meal Plan" }], 3)).toBe("2 rules · 3 charges not routed yet")
  })

  it("tells how many moved", () => {
    expect(movedTold(0, 0)).toBe("Nothing to move.")
    expect(movedTold(3, 0)).toBe("3 moved.")
    expect(movedTold(2, 1)).toBe("2 moved, 1 not moved. See the reasons below.")
    expect(movedTold(0, 2)).toBe("None moved. See the reasons below.")
  })
})
