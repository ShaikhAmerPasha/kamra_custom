/*  Global keyboard shortcuts, the key bar and the F1 help sheet (Kamra Custom).
    Mounted once in AppShell. Plain keys stay out of the way while the user types;
    F-keys and Alt keys always work. "click" shortcuts press the matching visible
    button on screen, so they follow whatever screen or dialog is open. */

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { X } from "lucide-react"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import {
  CHORD_MS,
  LABELS,
  SHORTCUTS,
  advancesOnEnter,
  altTwin,
  TILE_SCREENS,
  isTileLabel,
  isTyping,
  nextByDirection,
  keyCaps,
  matchKey,
  type Shortcut,
  type Target,
} from "./hotkeys"
import { count, flush } from "./usage"
import { clickAction, normalizePath } from "./usageNames"

const STAY_ACTIONS: { target: Target; label: string; key: string }[] = [
  { target: "checkin", label: "Check in", key: "F4" },
  { target: "checkout", label: "Check out", key: "F7" },
  { target: "payment", label: "Payment", key: "F8" },
  { target: "print", label: "Print", key: "F9" },
]
const GROUPS: Shortcut["group"][] = ["Desk", "Go to", "Help"]
const BAR_ATTR = "data-hotkey-bar"

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
}

/** Visible, enabled buttons for a target. An open dialog or sheet is searched alone. */
function findButtons(target: Target): HTMLElement[] {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(isVisible)
  const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document
  const re = LABELS[target]
  const hits = Array.from(scope.querySelectorAll<HTMLElement>("button, a[role='button']")).filter((el) => {
    if (el.closest(`[${BAR_ATTR}]`)) return false
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return false
    if (!isVisible(el)) return false
    const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim()
    return re.test(label)
  })
  // a button marked data-hk is the screen's own main action: prefer it over a plain twin
  const main = hits.filter((el) => el.hasAttribute("data-hk"))
  return main.length ? main : hits
}


function topDialog(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(isVisible)
  return all.length ? all[all.length - 1] : null
}

/** The confirm button of a dialog: the last enabled primary button. */
function primaryButton(dlg: HTMLElement): HTMLElement | null {
  const list = Array.from(dlg.querySelectorAll<HTMLButtonElement>("button.bg-brand-600")).filter(
    (b) => !b.disabled && isVisible(b),
  )
  return list.length ? list[list.length - 1] : null
}

/** The next field after `from` inside a dialog, in page order. */
function nextField(dlg: HTMLElement, from: HTMLElement): HTMLElement | null {
  const fields = Array.from(
    dlg.querySelectorAll<HTMLElement>("input, select, textarea"),
  ).filter((el) => {
    const f = el as HTMLInputElement
    if (f.disabled || f.readOnly || el.tabIndex < 0 || !isVisible(el)) return false
    return !["checkbox", "radio", "hidden", "button", "file", "submit"].includes((f.type ?? "").toLowerCase())
  })
  const i = fields.indexOf(from)
  if (i < 0) return null
  for (let j = i + 1; j < fields.length; j++) {
    const f = fields[j]
    // a prefix picker (country code) sitting next to its input: go straight to the input
    const after = fields[j + 1]
    if (f.tagName === "SELECT" && after && f.parentElement?.contains(after)) continue
    return f
  }
  return null
}

/** The list row a button sits in, so arrow keys can pick which guest F4 / F7 acts on. */
function rowOf(el: HTMLElement): HTMLElement {
  return (el.closest("tr, li, [role='row']") as HTMLElement | null) ?? (el.parentElement?.parentElement as HTMLElement) ?? el
}

/** Rows that hold a Check in or Check out button, top to bottom. */
function actionableRows(): HTMLElement[] {
  const btns = [...findButtons("checkin"), ...findButtons("checkout")]
  btns.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  const rows: HTMLElement[] = []
  for (const b of btns) {
    const r = rowOf(b)
    if (!rows.includes(r)) rows.push(r)
  }
  return rows
}

function paint(row: HTMLElement | null, on: boolean) {
  if (!row) return
  row.style.outline = on ? "2px solid #0f766e" : ""
  row.style.outlineOffset = on ? "-2px" : ""
}

/** Visible room tiles on a board, in page order. */
function roomTiles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("main button")).filter(
    (el) => isVisible(el) && el.getBoundingClientRect().width > 50 && isTileLabel(el.textContent ?? ""),
  )
}

/** True when a form with this heading is on screen. */
function hasForm(heading: RegExp): boolean {
  const scope: ParentNode = topDialog() ?? document
  return Array.from(scope.querySelectorAll<HTMLElement>("h2, h3, div")).some(
    (el) => el.children.length === 0 && heading.test((el.textContent ?? "").trim()) && isVisible(el),
  )
}

/** Alt+C: jump to the first field of the "Post a charge" form on a folio or room panel. */
function focusForm(heading: RegExp): boolean {
  const scope: ParentNode = topDialog() ?? document
  const head = Array.from(scope.querySelectorAll<HTMLElement>("h2, h3, [class*='CardTitle'], div"))
    .find((el) => el.children.length === 0 && heading.test((el.textContent ?? "").trim()))
  let box: HTMLElement | null = head?.parentElement ?? null
  for (let i = 0; box && i < 4; i++, box = box.parentElement) {
    const field = Array.from(box.querySelectorAll<HTMLElement>("input, select, textarea")).find(
      (el) => !(el as HTMLInputElement).disabled && isVisible(el),
    )
    if (field) {
      field.scrollIntoView({ block: "center" })
      field.focus()
      return true
    }
  }
  return false
}

const coarse = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches

export function Hotkeys({ onNewBooking }: { onNewBooking: () => void }) {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [help, setHelp] = useState(false)
  const [note, setNote] = useState("")
  const [live, setLive] = useState<Record<string, boolean>>({})
  const [stay, setStay] = useState<Record<string, boolean> | null>(null)
  const pending = useRef<{ key: string; at: number } | null>(null)
  const helpOpen = useRef(false)
  const cursor = useRef<HTMLElement | null>(null)
  helpOpen.current = help
  const noteTimer = useRef<number | undefined>(undefined)
  const showBar = !coarse()

  const flash = useCallback((msg: string) => {
    setNote(msg)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(""), 2500)
  }, [])

  const run = useCallback(
    (s: Shortcut) => {
      count(`key:${s.alt ? "alt+" : ""}${s.keys}`)
      if (s.action === "new-booking") onNewBooking()
      else if (s.action === "go" && s.to) navigate(s.to)
      else if (s.action === "help") setHelp((v) => !v)
      else if (s.action === "search")
        // reuse Kamra's command palette
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
      else if (s.action === "click" && s.target) {
        if (s.target === "charge") {
          if (!focusForm(LABELS.charge)) flash(t("No charge form on this screen"))
          return
        }
        let hits = findButtons(s.target)
        if (cursor.current?.isConnected && hits.length > 1) {
          hits = hits.filter((b) => rowOf(b) === cursor.current)
          if (hits.length === 0) {
            flash(t("Not available for the selected guest"))
            return
          }
        }
        if (s.target === "walkin" && hits.length === 0) {
          // Kamra keeps Walk-in as a tab inside the New booking sheet
          onNewBooking()
          window.setTimeout(() => findButtons("walkin")[0]?.click(), 600)
        } else if (s.target === "payment" && hits.length === 0 && focusForm(/^record a payment$/i)) {
          return
        } else if (hits.length === 1) hits[0].click()
        else if (hits.length > 1) flash(t("Several to choose from. Open one first."))
        else flash(t("Not available on this screen"))
      }
    },
    [flash, navigate, onNewBooking, t],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (e.key === "Escape") {
        pending.current = null
        if (cursor.current) {
          paint(cursor.current, false)
          cursor.current = null
        }
        if (helpOpen.current) {
          // close only the shortcut sheet, not the screen under it
          e.stopPropagation()
          setHelp(false)
        }
        return
      }
      if (e.key === "Enter" && !helpOpen.current) {
        const dlg = topDialog()
        if (dlg) {
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Enter confirms the open dialog, from any field
            const btn = primaryButton(dlg)
            e.preventDefault()
            if (btn) btn.click()
            else flash(t("Nothing to confirm yet. Fill the required fields."))
            return
          }
          const el = e.target as HTMLInputElement | null
          if (el && !e.shiftKey && !e.altKey && dlg.contains(el)) {
            const picker =
              el.hasAttribute("aria-autocomplete") ||
              el.hasAttribute("aria-expanded") ||
              el.getAttribute("role") === "combobox" ||
              el.hasAttribute("list")
            if (advancesOnEnter({ tag: el.tagName, type: el.type, picker, inForm: !!el.closest("form") })) {
              const next = nextField(dlg, el)
              if (next) {
                e.preventDefault()
                next.focus()
                if (next instanceof HTMLInputElement && next.type !== "date") next.select?.()
              }
            }
          }
          return
        }
      }
      const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const)[
        e.key as "ArrowUp"
      ]
      if (
        dir && TILE_SCREENS.includes(location.pathname) &&
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        !isTyping(e.target) && !topDialog() && !helpOpen.current
      ) {
        const tiles = roomTiles()
        if (tiles.length) {
          const at = tiles.indexOf(document.activeElement as HTMLElement)
          const to = at < 0 ? 0 : nextByDirection(tiles.map((t) => t.getBoundingClientRect()), at, dir)
          if (to >= 0) {
            tiles[to].focus()
            tiles[to].scrollIntoView({ block: "nearest" })
          }
          e.preventDefault()
          return
        }
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        !isTyping(e.target) && !topDialog() && !helpOpen.current
      ) {
        const rows = actionableRows()
        if (rows.length >= 2) {
          const at = cursor.current ? rows.indexOf(cursor.current) : -1
          const step = e.key === "ArrowDown" ? 1 : -1
          const next = rows[Math.min(rows.length - 1, Math.max(0, at < 0 ? (step > 0 ? 0 : rows.length - 1) : at + step))]
          paint(cursor.current, false)
          cursor.current = next
          paint(next, true)
          next.scrollIntoView({ block: "nearest" })
          e.preventDefault()
          return
        }
      }
      const p = pending.current && Date.now() - pending.current.at < CHORD_MS ? pending.current.key : null
      const m = matchKey(e, isTyping(e.target), p)
      if (m.kind === "pending") {
        pending.current = { key: m.first, at: Date.now() }
        return
      }
      pending.current = null
      if (m.kind === "hit") {
        e.preventDefault()
        run(m.shortcut)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [flash, location.pathname, run, t])


  // a clear ring on whatever the keyboard has reached
  useEffect(() => {
    const st = document.createElement("style")
    st.textContent =
      "button:focus-visible, a:focus-visible, [role=button]:focus-visible { outline: 3px solid #0f766e !important; outline-offset: 2px; }" +
      // tablets: finger-sized controls inside sheets and dialogs, where the desk fills forms
      "@media (pointer: coarse) { [role=dialog] button, [role=dialog] select, [role=dialog] input:not([type=checkbox]):not([type=radio]) { min-height: 44px; } }"
    document.head.appendChild(st)
    return () => st.remove()
  }, [])

  // count screens opened
  useEffect(() => {
    count(`view:${normalizePath(location.pathname)}`)
  }, [location.pathname])

  // count clicks on the main desk buttons, and send the counts every minute
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement | null)?.closest?.("button, a[role='button']") as HTMLElement | null
      if (btn && !btn.closest(`[${BAR_ATTR}]`)) count(clickAction(btn.getAttribute("aria-label") ?? btn.textContent ?? ""))
    }
    const hide = () => document.visibilityState === "hidden" && flush()
    const timer = window.setInterval(flush, 60_000)
    document.addEventListener("click", onClick, true)
    document.addEventListener("visibilitychange", hide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("visibilitychange", hide)
    }
  }, [])

  // which bar keys have a button to press right now
  useEffect(() => {
    let timer = 0
    const scan = () => {
      const next: Record<string, boolean> = {}
      for (const s of SHORTCUTS) if (s.bar && s.action === "click" && s.target) next[s.keys] = s.target === "walkin" || findButtons(s.target).length > 0 || (s.target === "payment" && hasForm(/^record a payment$/i))
      setLive((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      // a reservation panel is open: its main actions float within reach
      const dlg = topDialog()
      const isStay = !!dlg && /\bRES-\d/.test(dlg.querySelector("h1, h2, h3")?.textContent ?? "")
      const st = isStay ? Object.fromEntries(STAY_ACTIONS.map((a) => [a.target, findButtons(a.target).length > 0])) : null
      setStay((prev) => (JSON.stringify(prev) === JSON.stringify(st) ? prev : st))
    }
    const later = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(scan, 250)
    }
    scan()
    const mo = new MutationObserver(later)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class", "style"] })
    return () => {
      mo.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  // room at the bottom of the page for the bar
  useEffect(() => {
    if (!showBar) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = "2rem"
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [showBar])

  return (
    <>
      {showBar && (
        <div
          {...{ [BAR_ATTR]: "" }}
          className="fixed inset-x-0 bottom-0 z-40 flex h-8 items-center gap-1 overflow-x-auto border-t border-zinc-200 bg-white/95 px-2 text-xs backdrop-blur print:hidden"
          role="toolbar"
          aria-label={t("Keyboard shortcuts")}
        >
          {SHORTCUTS.filter((s) => s.bar).map((s) => {
            const off = s.action === "click" && live[s.keys] === false
            return (
              <button
                key={s.keys}
                type="button"
                tabIndex={-1}
                onClick={() => run(s)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-zinc-100",
                  off ? "text-zinc-300" : "text-zinc-700",
                )}
              >
                <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px]">{s.keys}</kbd>
                {t(s.label)}
              </button>
            )
          })}
        </div>
      )}
      {stay && (
        <div
          {...{ [BAR_ATTR]: "" }}
          className="fixed bottom-14 right-4 z-[60] flex gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-xl backdrop-blur print:hidden"
          role="toolbar"
          aria-label={t("Stay actions")}
        >
          {STAY_ACTIONS.filter((a) => stay[a.target]).map((a) => (
            <button
              key={a.target}
              type="button"
              onClick={() => findButtons(a.target)[0]?.click()}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t(a.label)}
              {showBar && <kbd className="rounded bg-white/20 px-1 font-mono text-[10px]">{a.key}</kbd>}
            </button>
          ))}
        </div>
      )}
      {note && (
        <div
          role="status"
          className="fixed left-1/2 top-3 z-[80] -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white shadow-lg"
        >
          {note}
        </div>
      )}
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </>
  )
}

function HelpSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const rows = SHORTCUTS.filter((s) => !s.alt && !(s.action === "help" && s.keys === "?"))
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("Keyboard shortcuts")}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{t("Keyboard shortcuts")}</h2>
          <button type="button" className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100" aria-label={t("Close")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {GROUPS.map((g) => (
          <div key={g} className="mb-3">
            <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t(g)}</div>
            {rows
              .filter((s) => s.group === g)
              .map((s) => {
                const twin = altTwin(s)
                return (
                  <div key={s.keys} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-zinc-700">{t(s.label)}</span>
                    <span className="flex items-center gap-1">
                      {[s, ...(twin ? [twin] : [])].map((x, j) => (
                        <span key={j} className="flex gap-0.5">
                          {j > 0 && <span className="px-1 text-zinc-300">or</span>}
                          {keyCaps(x).map((k, i) => (
                            <kbd key={i} className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                              {k}
                            </kbd>
                          ))}
                        </span>
                      ))}
                    </span>
                  </div>
                )
              })}
          </div>
        ))}
        <p className="text-xs text-zinc-400">
          {t("Esc closes this. F-keys and Alt keys work in any field. Letter keys work only outside fields.")}
        </p>
      </div>
    </div>
  )
}
