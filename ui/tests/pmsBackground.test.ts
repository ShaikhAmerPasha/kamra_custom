import { describe, expect, it } from "vitest"
import { readLastBackground, MYCLOUD_SCREENS, MYCLOUD_WORDS, PMS_CHOICES, aliasTerms, defaultViewFor, readBackground, wordsFor, writeBackground } from "../overlay/src/custom/pmsBackground"

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe("saved answer", () => {
  it("is MyCloud until the person chooses another system: nobody is asked", () => expect(readBackground(memory(), "a@x")).toBe("mycloud"))
  it("remembers the answer per user", () => {
    const s = memory()
    writeBackground(s, "a@x", "opera")
    expect(readBackground(s, "a@x")).toBe("opera")
    expect(readBackground(s, "b@x")).toBe("mycloud")
  })
  it("ignores a value it does not know", () => {
    const s = memory()
    s.setItem("kamra:pms-background:a@x", "other-thing")
    expect(readBackground(s, "a@x")).toBe("mycloud")
  })
  it("survives storage that refuses", () => {
    const bad = { getItem: () => { throw new Error("no") }, setItem: () => { throw new Error("no") } }
    expect(readBackground(bad, "a@x")).toBe("mycloud")
    expect(() => writeBackground(bad, "a@x", "mycloud")).not.toThrow()
    expect(readBackground(null, "a@x")).toBe("mycloud")
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

describe("last answer in the browser", () => {
  it("is remembered for the first paint", () => {
    const s = memory()
    expect(readLastBackground(s)).toBe("mycloud")
    writeBackground(s, "a@x", "mycloud")
    expect(readLastBackground(s)).toBe("mycloud")
    writeBackground(s, "b@x", "none")
    expect(readLastBackground(s)).toBe("none")
  })
  it("survives missing storage", () => expect(readLastBackground(null)).toBe("mycloud"))
})
