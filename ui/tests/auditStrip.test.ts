import { describe, expect, it } from "vitest"
import { auditNotice, showOnPath } from "../overlay/src/custom/auditStrip"

describe("auditNotice", () => {
  it("is nothing when the audit is up to date", () => {
    expect(auditNotice({ behind: 0, business_date: "2026-11-27", today: "2026-11-27" })).toBeNull()
  })
  it("is nothing when the answer is missing", () => {
    expect(auditNotice(null)).toBeNull()
    expect(auditNotice(undefined)).toBeNull()
  })
  it("says how many days, singular and plural", () => {
    expect(auditNotice({ behind: 1, business_date: "2026-11-26", today: "2026-11-27" })?.text).toContain("1 day behind")
    expect(auditNotice({ behind: 2, business_date: "2026-11-25", today: "2026-11-27" })?.text).toContain("2 days behind")
  })
})

describe("showOnPath", () => {
  it("hides on the night audit screen only", () => {
    expect(showOnPath("/end-of-day")).toBe(false)
    expect(showOnPath("/tape")).toBe(true)
    expect(showOnPath("/")).toBe(true)
  })
})
