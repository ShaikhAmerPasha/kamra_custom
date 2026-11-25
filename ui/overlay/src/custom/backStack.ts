/*  Back closes the top pop-up (Kamra Custom). A full-page dialog or a side panel is not a page of its
    own, so the browser's Back (or a trackpad swipe) used to do nothing, or leave the whole screen.
    Each open pop-up pushes one history entry; Back pops it and closes only the top pop-up. Closing a
    pop-up with its own button removes its entry again, so Back never lands on a stale one.
    Free of React; the window and history are passed in so it can be tested. */

export interface HistoryLike {
  state: unknown
  pushState(state: unknown, title: string): void
  back(): void
}
export interface WindowLike {
  addEventListener(type: "popstate", fn: () => void): void
  removeEventListener(type: "popstate", fn: () => void): void
}

interface Entry {
  id: number
  close: () => void
}

export function createBackStack(win: WindowLike, hist: HistoryLike) {
  const entries: Entry[] = []
  let next = 1
  let skip = 0

  const onPop = () => {
    if (skip > 0) {
      skip -= 1
      return
    }
    entries.pop()?.close()
    if (entries.length === 0) win.removeEventListener("popstate", onPop)
  }

  /** Register an open pop-up. Returns the function to call when it closes by itself. */
  function open(close: () => void): () => void {
    const entry: Entry = { id: next++, close }
    if (entries.length === 0) win.addEventListener("popstate", onPop)
    entries.push(entry)
    hist.pushState({ ...(typeof hist.state === "object" && hist.state ? hist.state : {}), kdPopup: entry.id }, "")
    return () => {
      const at = entries.indexOf(entry)
      if (at < 0) return // Back closed it already
      const wasTop = at === entries.length - 1
      entries.splice(at, 1)
      if (entries.length === 0) win.removeEventListener("popstate", onPop)
      const mine = (hist.state as { kdPopup?: number } | null)?.kdPopup === entry.id
      if (wasTop && mine) {
        skip += 1
        if (entries.length > 0) win.addEventListener("popstate", onPop)
        hist.back()
      }
    }
  }

  return { open, depth: () => entries.length }
}
