import { describe, expect, it } from "vitest"
import { readLastBackground, MYCLOUD_SCREENS, MYCLOUD_WORDS, PMS_CHOICES, aliasTerms, defaultViewFor, readBackground, wordsFor } from "../overlay/src/custom/pmsBackground"

describe("the previous system", () => {
  it("is always MyCloud: nobody is asked and nothing is saved", () => {
    expect(readBackground()).toBe("mycloud")
    expect(readLastBackground()).toBe("mycloud")
    expect(defaultViewFor(readBackground())).toBe("full")
  })
})

describe("layout and words", () => {
  it("starts MyCloud and WinHMS users in the full form", () => {
    expect(defaultViewFor("mycloud")).toBe("full")
    expect(defaultViewFor("winhms")).toBe("full")
  })
  it("starts everyone else guided", () => {
    for (const id of ["opera", "other", "none", null] as const) expect(defaultViewFor(id)).toBe("guided")
  })
  it("has MyCloud words only for MyCloud", () => {
    expect(wordsFor("mycloud")).toBe(MYCLOUD_WORDS)
    expect(wordsFor("winhms")).toEqual({})
    expect(wordsFor(null)).toEqual({})
  })
  it("renames Billing to Cashiering", () => expect(MYCLOUD_WORDS.Billing).toBe("Cashiering"))
  it("lists each choice once", () => expect(new Set(PMS_CHOICES.map((c) => c.id)).size).toBe(PMS_CHOICES.length))
})

describe("screen names", () => {
  it("points every MyCloud screen at a Kamra path", () => {
    for (const e of MYCLOUD_SCREENS) expect(e.to.startsWith("/")).toBe(true)
  })
  it("has no screen name twice", () => {
    const names = MYCLOUD_SCREENS.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
  it("gives search every name that leads to a screen", () => {
    const terms = aliasTerms("/receivables")
    expect(terms).toContain("Debtor account")
    expect(terms).toContain("Non room accounts")
  })
  it("ignores a query string when matching a path", () => expect(aliasTerms("/in-house")).toContain("Manual No-Show"))
  it("is empty for a screen no name points at", () => {
    expect(aliasTerms("/nowhere")).toBe("")
    expect(aliasTerms(undefined)).toBe("")
  })
})

