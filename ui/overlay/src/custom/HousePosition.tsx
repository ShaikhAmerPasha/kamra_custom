/*  House position button for the top bar (Kamra Custom). Shows occupied over sellable rooms;
    a click opens the room and movement counts for today. Refreshes on open and every minute. */

import { useCallback, useEffect, useRef, useState } from "react"
import { Building2 } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { housePosition, type DashboardSlice } from "./housePosition"

const TONE = {
  plain: "text-zinc-900 dark:text-zinc-100",
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
}

export function HousePosition() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<DashboardSlice | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    call<DashboardSlice>("kamra.dashboards.property_dashboard", { property: getCurrentProperty() })
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

  const p = housePosition(data)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("House position")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
      >
        <Building2 className="h-4 w-4" />
        <span className="tabular-nums">
          {p.occupied}/{p.sellable}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("House position")}
          className="absolute end-0 top-10 z-50 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{t("House position")}</span>
            <span className="text-xs text-muted-foreground">{t("Today")}</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{p.pct}%</div>
          <div className="text-xs text-muted-foreground">
            {p.occupied} {t("of")} {p.sellable} {t("sellable rooms")}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {p.rooms.map((r) => (
              <div key={r.label} className="flex justify-between">
                <dt className="text-muted-foreground">{t(r.label)}</dt>
                <dd className={cn("font-medium tabular-nums", TONE[r.tone])}>{r.count}</dd>
              </div>
            ))}
          </dl>
          <hr className="my-3" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {p.today.map((r) => (
              <div key={r.label} className="flex justify-between">
                <dt className="text-muted-foreground">{t(r.label)}</dt>
                <dd className="font-medium tabular-nums">{r.count}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
