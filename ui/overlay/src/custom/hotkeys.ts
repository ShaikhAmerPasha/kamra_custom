/*  Keyboard shortcuts (Kamra Custom): one table, plain TypeScript.
    The listener, the key bar and the help sheet all read SHORTCUTS, so what the
    help says is what the keys do.

    F-keys and Alt+letter are the main set (hotel desk habit). "g" chords are extra.
    A "click" action presses the visible button whose label matches LABELS, so
    Kamra's own screens need no change. */

export type Target = "checkin" | "checkout" | "payment" | "print" | "walkin" | "folio" | "charge"

export type Action = "new-booking" | "search" | "help" | "go" | "click"

export type Shortcut = {
  /** One key ("F4", "n", "/"), or a chord of two ("g r"). */
  keys: string
  alt?: boolean
  label: string
  action: Action
  /** Route for action "go". */
  to?: string
  /** Button to press for action "click". */
  target?: Target
  group: "Desk" | "Go to" | "Help"
  /** Show on the key bar at the bottom of the screen. */
  bar?: boolean
}

/** Visible button labels each target presses. Kamra writes both "Check in" and "Check-in". */
export const LABELS: Record<Target, RegExp> = {
  checkin: /^check[ -]?in\b/i,
  checkout: /^check[ -]?out\b/i,
  payment: /^(record payment|take payment|add payment|settle)\b/i,
  print: /^print\b/i,
  walkin: /^walk[ -]?in$/i,
  folio: /^(open )?(folio|bill)$/i,
  charge: /^post (a )?charge\b/i,
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "F1", label: "Shortcuts", action: "help", group: "Help", bar: true },
  { keys: "F2", label: "New booking", action: "new-booking", group: "Desk", bar: true },
  { keys: "F3", label: "Walk-in", action: "click", target: "walkin", group: "Desk", bar: true },
  { keys: "F4", label: "Check in", action: "click", target: "checkin", group: "Desk", bar: true },
  { keys: "F7", label: "Check out", action: "click", target: "checkout", group: "Desk", bar: true },
  { keys: "F8", label: "Payment", action: "click", target: "payment", group: "Desk", bar: true },
  { keys: "F9", label: "Print", action: "click", target: "print", group: "Desk", bar: true },
  { keys: "F10", label: "Find", action: "search", group: "Desk", bar: true },

  { keys: "n", alt: true, label: "New booking", action: "new-booking", group: "Desk" },
  { keys: "w", alt: true, label: "Walk-in", action: "click", target: "walkin", group: "Desk" },
  { keys: "i", alt: true, label: "Check in", action: "click", target: "checkin", group: "Desk" },
  { keys: "o", alt: true, label: "Check out", action: "click", target: "checkout", group: "Desk" },
  { keys: "y", alt: true, label: "Payment", action: "click", target: "payment", group: "Desk" },
  { keys: "p", alt: true, label: "Print", action: "click", target: "print", group: "Desk" },
  { keys: "c", alt: true, label: "Post a charge", action: "click", target: "charge", group: "Desk" },
  { keys: "f", alt: true, label: "Find", action: "search", group: "Desk" },
  { keys: "/", label: "Find", action: "search", group: "Help" },
  { keys: "?", label: "Shortcuts", action: "help", group: "Help" },

  { keys: "g t", label: "Today", action: "go", to: "/", group: "Go to" },
  { keys: "g h", label: "In House", action: "go", to: "/in-house", group: "Go to" },
  { keys: "g s", label: "Reservations", action: "go", to: "/reservations", group: "Go to" },
  { keys: "g r", label: "Room Board", action: "go", to: "/room-board", group: "Go to" },
  { keys: "g c", label: "Tape Chart", action: "go", to: "/tape", group: "Go to" },
  { keys: "g b", label: "Billing", action: "go", to: "/billing", group: "Go to" },
  { keys: "g g", label: "Guest History", action: "go", to: "/guests", group: "Go to" },
  { keys: "g k", label: "Cashier", action: "go", to: "/cashier", group: "Go to" },
  { keys: "g e", label: "Night Audit", action: "go", to: "/end-of-day", group: "Go to" },
  { keys: "g p", label: "Reports", action: "go", to: "/reports", group: "Go to" },
]

export const CHORD_MS = 1200

/** True when the key press belongs to a text field, a dropdown or an editor. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== "string") return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true
}

export type KeyLike = {
  key: string
  /** Physical key, "KeyN". With Option on a Mac `key` is not "n", so Alt shortcuts read this. */
  code?: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type Match =
  | { kind: "none" }
  | { kind: "pending"; first: string }
  | { kind: "hit"; shortcut: Shortcut }

const FKEY = /^F([1-9]|1[0-2])$/

/** Decide what one key press means. `pending` is the first key of a chord, if one is waiting. */
export function matchKey(e: KeyLike, typing: boolean, pending: string | null): Match {
  if (e.ctrlKey || e.metaKey) return { kind: "none" }
  const raw = e.key
  if (raw === "Shift" || raw === "Alt" || raw === "Control" || raw === "Meta") return { kind: "none" }

  // F-keys work everywhere, also while typing, like the desk software they know
  if (FKEY.test(raw)) {
    const hit = SHORTCUTS.find((s) => !s.alt && s.keys === raw)
    return hit ? { kind: "hit", shortcut: hit } : { kind: "none" }
  }

  if (e.altKey) {
    const k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : raw.toLowerCase()
    const hit = SHORTCUTS.find((s) => s.alt && s.keys === k)
    return hit ? { kind: "hit", shortcut: hit } : { kind: "none" }
  }
  if (typing) return { kind: "none" }

  const key = raw.length === 1 ? raw.toLowerCase() : raw
  if (pending) {
    const hit = SHORTCUTS.find((s) => s.keys === `${pending} ${key}`)
    if (hit) return { kind: "hit", shortcut: hit }
    // not a chord: this key may start a new one
  }
  const single = SHORTCUTS.find((s) => !s.alt && s.keys === key)
  if (single) return { kind: "hit", shortcut: single }
  if (SHORTCUTS.some((s) => s.keys.startsWith(`${key} `))) return { kind: "pending", first: key }
  return { kind: "none" }
}

/** "g r" -> ["G", "R"], so the help sheet draws each key as a cap. */
export function keyCaps(s: Shortcut): string[] {
  const caps = s.keys.split(" ").map((k) => (k.length === 1 ? k.toUpperCase() : k))
  return s.alt ? ["Alt", ...caps] : caps
}

/** The Alt+letter twin of a shortcut, for the help sheet. */
export function altTwin(s: Shortcut): Shortcut | undefined {
  return SHORTCUTS.find((x) => x.alt && x !== s && x.action === s.action && x.target === s.target)
}

/** Pick the button to press. Returns an index into `labels`, or -1 when none or more than one fits. */
export function pickButton(labels: string[], target: Target): number {
  const hits = labels.map((l, i) => (LABELS[target].test(l.trim()) ? i : -1)).filter((i) => i >= 0)
  return hits.length === 1 ? hits[0] : -1
}

/** Field types where Enter moves to the next field. Text areas keep Enter for a new line. */
const ADVANCE_TYPES = new Set(["text", "number", "tel", "email", "date", "time", "search", "url", "password"])

export type FieldInfo = {
  tag: string
  type?: string
  /** role="combobox", aria-autocomplete, aria-expanded or a list: Enter may pick an item. */
  picker: boolean
  /** Inside a <form>: Enter may submit it, so leave it alone. */
  inForm: boolean
}

/** True when Enter in this field should move focus to the next field. */
export function advancesOnEnter(f: FieldInfo): boolean {
  if (f.tag !== "INPUT" || f.picker || f.inForm) return false
  return ADVANCE_TYPES.has((f.type ?? "text").toLowerCase())
}

export type Rect = { left: number; top: number; width: number; height: number }
export type Dir = "up" | "down" | "left" | "right"

/** Screens where the arrow keys walk across the room tiles. */
export const TILE_SCREENS = ["/room-board", "/housekeeping-board"]

/** A room tile's label starts with the room number. */
export const isTileLabel = (text: string) => /^[A-Za-z]{0,3}\d{1,4}(?!\d)/.test(text.trim())

/** The tile nearest in a direction, preferring the same row or column. -1 when there is none. */
export function nextByDirection(rects: Rect[], from: number, dir: Dir): number {
  const c = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  const a = c(rects[from])
  let best = -1
  let bestScore = Infinity
  rects.forEach((r, i) => {
    if (i === from) return
    const p = c(r)
    const dx = p.x - a.x
    const dy = p.y - a.y
    const ahead = dir === "right" ? dx > 1 : dir === "left" ? dx < -1 : dir === "down" ? dy > 1 : dy < -1
    if (!ahead) return
    const along = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy)
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx)
    const score = along + 3 * across
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}
