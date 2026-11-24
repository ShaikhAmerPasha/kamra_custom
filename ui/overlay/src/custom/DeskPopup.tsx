/*  A section of a dense desk form that lives in a pop-up (Kamra Custom).
    On the page it is one titled row: a line saying what was entered, and a button to change it.
    The fields sit in a small centred card. The fields write straight into the form, so OK only
    closes the card; nothing is lost by closing it. A red dot on the row marks missing data. */

import { useEffect, useState, type ReactNode } from "react"
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
          {props.missing ? <i className="kd-dot" aria-label={t("Something is missing")} /> : null}
          {props.summary || t("None")}
        </span>
        <button type="button" onClick={() => setOpen(true)}>
          {empty ? (props.addLabel ?? t("Add")) : t("Edit")}
        </button>
      </div>
      {open
        ? createPortal(
            <div className="kd kd-modal" role="dialog" aria-modal="true" aria-label={props.title}
              onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <div className={"kd-pop" + (props.wide ? " kd-pop-wide" : "")}>
                <div className="kd-pop-head">{props.title}</div>
                <div className="kd-pop-body kd-grid-1">{props.children}</div>
                <div className="kd-pop-foot">
                  <Button className="h-8 px-6 text-sm" onClick={() => setOpen(false)} autoFocus>{t("OK")}</Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
