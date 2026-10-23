/*  Dirty rooms on Kamra's Room Board (Kamra Custom).
    A button with the count opens a panel: each dirty room, when its guest
    checked out, how long it has waited. The report downloads as an Excel file. The
    numbers come from kamra_custom.housekeeping.dirty_room_report. */

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Button } from "../components/ui/button"
import { useT } from "../lib/i18n"
import { dateTimeOf, downloadUrl, timeOf, type DirtyReport } from "./dirtyReport"
import { formatElapsed } from "./duration"

export type DirtyState = { report: DirtyReport | null; failed: boolean }

/** The report, refreshed whenever the board's own room list changes. */
export function useDirtyReport(boardRooms: unknown): DirtyState {
  const [state, setState] = useState<DirtyState>({ report: null, failed: false })
  useEffect(() => {
    let live = true
    call<DirtyReport>("kamra_custom.housekeeping.dirty_room_report", { property: getCurrentProperty() })
      .then((report) => live && setState({ report, failed: false }))
      .catch(() => live && setState((s) => ({ ...s, failed: true })))
    return () => {
      live = false
    }
  }, [boardRooms])
  return state
}

/** "Out 11:42 · 2h 10m" under a dirty room's tile. Nothing for other rooms. */
export function DirtyRoomLine({ state, room }: { state: DirtyState; room: string }) {
  const row = state.report?.rows.find((r) => r.room === room)
  if (!row) return null
  const from = row.checked_out_at ? `Out ${timeOf(row.checked_out_at)}` : `Dirty ${timeOf(row.dirty_since)}`
  return <div className="mt-1 text-xs font-medium opacity-90">{from} · {formatElapsed(row.elapsed_minutes)}</div>
}

export function DirtyRoomsButton({ state }: { state: DirtyState }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const report = state.report
  const count = report?.rows.length ?? 0

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={!report}>
        {t("Dirty rooms")}
        <span className="ml-1 rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800">{count}</span>
      </Button>
      {open && report ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-label={t("Dirty rooms")}
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">{t("Dirty rooms")} ({count})</h2>
                <p className="text-xs text-zinc-500">{t("Longest waiting first.")} {report.generated_at.slice(0, 16)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => window.location.assign(downloadUrl(getCurrentProperty()))} disabled={!count}>
                  <Download className="size-4" aria-hidden />
                  {t("Download report")}
                </Button>
                <button type="button" aria-label={t("Close")} onClick={() => setOpen(false)} className="rounded p-1 hover:bg-zinc-100">
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {count === 0 ? (
                <p className="text-sm text-zinc-500">{t("No dirty rooms right now.")}</p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-3">{t("Room")}</th>
                      <th className="py-2 pr-3">{t("Last checkout")}</th>
                      <th className="py-2 pr-3">{t("Dirty since")}</th>
                      <th className="py-2 pr-3">{t("Waiting")}</th>
                      <th className="py-2 pr-3">{t("Cleaning")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.rows.map((r) => (
                      <tr key={r.room}>
                        <td className="py-2 pr-3">
                          <b>{r.room_number}</b>
                          <span className="text-zinc-500">
                            {" "}· {r.room_type ? r.room_type.split("-").pop() : ""}{r.floor ? ` · ${t("floor")} ${r.floor}` : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {r.last_checkout_at ? dateTimeOf(r.last_checkout_at) : <span className="text-zinc-400">{t("None on record")}</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {dateTimeOf(r.dirty_since)}
                          <div className="text-xs text-zinc-500">{t(r.reason)}</div>
                        </td>
                        <td className="py-2 pr-3 font-medium">{formatElapsed(r.elapsed_minutes)}</td>
                        <td className="py-2 pr-3 text-zinc-600">
                          {r.task_status ?? t("No task")}{r.assigned_to ? ` · ${r.assigned_to}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
