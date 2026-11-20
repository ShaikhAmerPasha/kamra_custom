import { describe, expect, it } from "vitest"
import { readView, writeView } from "../overlay/src/custom/formView"

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe("form view choice", () => {
  it("is guided until someone chooses", () => expect(readView(memory(), "a@x")).toBe("guided"))
  it("remembers the full form", () => {
    const s = memory()
    writeView(s, "a@x", "full")
    expect(readView(s, "a@x")).toBe("full")
  })
  it("keeps each user's choice apart", () => {
    const s = memory()
    writeView(s, "a@x", "full")
    expect(readView(s, "b@x")).toBe("guided")
  })
  it("can go back to guided", () => {
    const s = memory()
    writeView(s, "a@x", "full")
    writeView(s, "a@x", "guided")
    expect(readView(s, "a@x")).toBe("guided")
  })
  it("survives storage that is missing or refuses", () => {
    const bad = { getItem: () => { throw new Error("no") }, setItem: () => { throw new Error("no") } }
    expect(readView(bad, "a@x")).toBe("guided")
    expect(() => writeView(bad, "a@x", "full")).not.toThrow()
    expect(readView(null, "a@x")).toBe("guided")
    expect(() => writeView(undefined, "a@x", "full")).not.toThrow()
  })
  it("treats an unknown saved value as guided", () => {
    const s = memory()
    s.setItem("kamra:form-view:a@x", "weird")
    expect(readView(s, "a@x")).toBe("guided")
  })
})
