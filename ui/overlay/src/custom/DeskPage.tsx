/*  A full-page shell for dense desk forms (Kamra Custom): a thin title bar, the form, and one bar of
    actions at the foot. It replaces the half-width side sheet where the whole record should be seen
    at once. The look comes from desk.css (the `kd` class). */

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"
import { useT } from "../lib/i18n"
import "./desk.css"

export function DeskPage(props: { title: ReactNode; description?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; wide?: boolean }) {
  const { t } = useT()
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [props])
  return (
    <div className="kd fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <header className="kd-head flex shrink-0 items-center gap-3">
        <h2 className="font-semibold">{props.title}</h2>
        {props.description ? <span className="truncate text-xs text-zinc-600">{props.description}</span> : null}
        <button type="button" className="ms-auto rounded p-0.5 hover:bg-zinc-200" onClick={props.onClose} aria-label={t("Close")}>
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="kd-body min-h-0 flex-1 overflow-y-auto">{props.children}</div>
      {props.footer ? <footer className="kd-actions shrink-0">{props.footer}</footer> : null}
    </div>
  )
}
