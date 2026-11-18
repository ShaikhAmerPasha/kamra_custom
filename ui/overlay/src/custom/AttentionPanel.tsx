/*  The "Needs attention" button in the top bar (Kamra Custom): what is wrong at the desk right now,
    one list, each item one click from its fix. Refreshes on open and every minute. */

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { call, getCurrentProperty } from "../lib/api"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"

interface Item {
  reservation: string
  guest: string
  room: string
  detail: string
  open: "check_out" | "bill" | "reservation" | "night_audit"
}
interface Group {
  key: string
  label: string
  count: number
  items: Item[]
}
interface Data {
  total: number
  groups: Group[]
}

export function AttentionPanel() {
  const { t } = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    call<Data>("kamra_custom.attention.attention", { property: getCurrentProperty() })
      .then(setData)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!open) return
    load()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, load])

  const go = async (i: Item) => {
    setOpen(false)
    if (i.open === "night_audit") return navigate("/end-of-day")
    if (i.open === "check_out") return navigate(`/in-house?tab=in-house&checkout=${encodeURIComponent(i.reservation)}`)
    if (i.open === "bill") {
      try {
        const d = await call<{ folio_name?: string }>("kamra.api.reservation_detail", { reservation: i.reservation })
        if (d.folio_name) return navigate(`/billing/${encodeURIComponent(d.folio_name)}`)
      } catch {
        /* fall through to the reservation */
      }
    }
    navigate(`/grc/${encodeURIComponent(i.reservation)}`)
  }

  const total = data?.total ?? 0
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("Needs attention")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted",
          total > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "text-zinc-500",
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="tabular-nums">{total}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("Needs attention")}
          className="absolute end-0 top-10 z-50 max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{t("Needs attention")}</span>
            <span className="text-xs text-zinc-500">{total}</span>
          </div>
          {!data || data.groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">{t("Nothing needs attention right now.")}</p>
          ) : (
            data.groups.map((g) => (
              <div key={g.key} className="mt-3 border-t border-zinc-100 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{t(g.label)}</span>
                  <span className="text-rose-600">{g.count}</span>
                </div>
                {g.items.map((i) => (
                  <button
                    key={i.reservation}
                    type="button"
                    onClick={() => void go(i)}
                    className="mt-1 flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-start text-sm hover:bg-zinc-50"
                  >
                    <span className="min-w-0 truncate">
                      {i.guest}
                      {i.room ? ` · ${i.room}` : ""}
                      <span className="ms-1 text-xs text-zinc-500">{i.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-brand-700">{t("Open")}</span>
                  </button>
                ))}
                {g.count > g.items.length && (
                  <div className="px-1 pt-1 text-xs text-zinc-500">
                    {t("and {n} more", { n: g.count - g.items.length })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
