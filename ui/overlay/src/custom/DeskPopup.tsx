/*  A section of a dense desk form that lives in a pop-up (Kamra Custom).
    On the page it is one titled row: a line saying what was entered, and a button to change it.
    The fields sit in a small centred card. The fields write straight into the form, so OK only
    closes the card; nothing is lost by closing it. A red dot on the row marks missing data. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useT } from "../lib/i18n"
import { Button } from "../components/ui/button"
import "./desk.css"

export function DeskPopup(props: {
  title: string
  /** What is entered, in one line: "2 extra · ₹500 a night". */
  summary: string
  /** Something required is missing: the row shows a red dot. */
  missing?: boolean
  /** The button label when nothing is entered yet. */
  addLabel?: string
  wide?: boolean
  children: ReactNode
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const opener = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)

  // focus moves into the card on open (first field, else OK) and back to the button on close
  useEffect(() => {
    if (open) {
      const first = card.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")
      ;(first ?? card.current?.querySelector<HTMLElement>("button"))?.focus()
    } else opener.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // capture: the page behind also closes on Escape, and must not
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  const empty = !props.summary
  return (
    <div data-bar={props.title}>
      <div className="kd-popup-row">
        <span className={"kd-popup-sum" + (empty ? " kd-popup-none" : "")} title={props.summary}>
          {props.missing ? <i className="kd-dot" aria-hidden /> : null}
          {props.summary || t("None")}
          {props.missing ? <b className="kd-need">{t("Required info missing")}</b> : null}
        </span>
        <button type="button" ref={opener} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {empty ? (props.addLabel ?? t("Add")) : t("Edit")}
        </button>
      </div>
      {open
        ? createPortal(
            <div className="kd kd-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
              onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <div ref={card} className={"kd-pop" + (props.wide ? " kd-pop-wide" : "")}>
                <div className="kd-pop-head" id={titleId}>{props.title}</div>
                <div className="kd-pop-body kd-grid-1">{props.children}</div>
                <div className="kd-pop-foot">
                  <Button className="h-8 px-6 text-sm" onClick={() => setOpen(false)}>{t("OK")}</Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
