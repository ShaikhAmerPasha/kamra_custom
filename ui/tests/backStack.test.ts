import { describe, expect, it } from "vitest"
import { createBackStack, type HistoryLike, type WindowLike } from "../overlay/src/custom/backStack"

/** A browser's history and popstate, as plainly as it goes: back() moves one step and fires popstate. */
function fakeBrowser() {
  const states: unknown[] = [null]
  let at = 0
  const listeners = new Set<() => void>()
  const hist: HistoryLike = {
    get state() { return states[at] },
    pushState(s) { states.splice(at + 1); states.push(s); at += 1 },
    back() { if (at > 0) { at -= 1; [...listeners].forEach((f) => f()) } },
  }
  const win: WindowLike = {
    addEventListener: (_t, fn) => { listeners.add(fn) },
    removeEventListener: (_t, fn) => { listeners.delete(fn) },
  }
  return { hist, win, listeners, position: () => at }
}

describe("back closes the top pop-up", () => {
  it("Back closes it and leaves the page where it was", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    let closed = 0
    s.open(() => closed++)
    expect(b.position()).toBe(1)
    b.hist.back()
    expect(closed).toBe(1)
    expect(b.position()).toBe(0)
    expect(s.depth()).toBe(0)
  })

  it("closing with its own button removes its history entry, so Back is not stuck", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const release = s.open(() => {})
    release()
    expect(b.position()).toBe(0)
    expect(s.depth()).toBe(0)
  })

  it("closes only the top one when two are open", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const log: string[] = []
    s.open(() => log.push("panel"))
    s.open(() => log.push("dialog"))
    b.hist.back()
    expect(log).toEqual(["dialog"])
    expect(s.depth()).toBe(1)
    b.hist.back()
    expect(log).toEqual(["dialog", "panel"])
    expect(b.position()).toBe(0)
  })

  it("a button close of the top one leaves the one below open and still closable by Back", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const log: string[] = []
    s.open(() => log.push("panel"))
    const releaseTop = s.open(() => log.push("dialog"))
    releaseTop()
    expect(log).toEqual([])
    expect(s.depth()).toBe(1)
    b.hist.back()
    expect(log).toEqual(["panel"])
    expect(b.position()).toBe(0)
  })

  it("a close after Back already closed it does nothing more", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const release = s.open(() => {})
    b.hist.back()
    release()
    expect(b.position()).toBe(0)
  })

  it("keeps the router's own history state", () => {
    const b = fakeBrowser()
    b.hist.pushState({ idx: 4, key: "k" }, "")
    const s = createBackStack(b.win, b.hist)
    s.open(() => {})
    expect(b.hist.state).toMatchObject({ idx: 4, key: "k", kdPopup: 1 })
  })

  it("a pop-up closed by leaving the page leaves no step that Back lands on and seems to do nothing", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const release = s.open(() => {})
    b.hist.pushState({ idx: 5 }, "") // a link inside the pop-up went to another screen
    release() // the pop-up unmounts: its step is not the top one
    expect(b.position()).toBe(2)
    b.hist.back() // from the new screen: onto the pop-up's leftover step ...
    expect(b.position()).toBe(0) // ... which is skipped, so one Back reaches the page before
  })

  it("an ordinary later pop-up still works after a skipped one", () => {
    const b = fakeBrowser()
    const s = createBackStack(b.win, b.hist)
    const r1 = s.open(() => {})
    b.hist.pushState({ idx: 5 }, "")
    r1()
    b.hist.back()
    let closed = 0
    s.open(() => closed++)
    b.hist.back()
    expect(closed).toBe(1)
  })
})
