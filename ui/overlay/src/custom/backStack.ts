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
  // pop-ups that closed because their page was left by a link: their history step is still there, and Back
  // must run straight through it instead of landing on a screen that looks unchanged
  const dead = new Set<number>()
  let next = 1
  let skip = 0
  let listening = false

  const onPop = () => {
    if (skip > 0) {
      skip -= 1
      return
    }
    if (entries.length > 0) {
      entries.pop()?.close()
      return
    }
    const at = (hist.state as { kdPopup?: number } | null)?.kdPopup
    if (at != null && dead.has(at)) hist.back()
  }
  const listen = () => {
    if (!listening) {
      win.addEventListener("popstate", onPop)
      listening = true
    }
  }

  /** Register an open pop-up. Returns the function to call when it closes by itself. */
  function open(close: () => void): () => void {
    const entry: Entry = { id: next++, close }
    listen()
    entries.push(entry)
    hist.pushState({ ...(typeof hist.state === "object" && hist.state ? hist.state : {}), kdPopup: entry.id }, "")
    return () => {
      const at = entries.indexOf(entry)
      if (at < 0) return // Back closed it already
      const wasTop = at === entries.length - 1
      entries.splice(at, 1)
      const mine = (hist.state as { kdPopup?: number } | null)?.kdPopup === entry.id
      if (wasTop && mine) {
        skip += 1
        hist.back()
      } else {
        dead.add(entry.id)
      }
    }
  }

  return { open, depth: () => entries.length }
}
