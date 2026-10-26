/*  The complimentary stay box in Kamra's check-in steps (Kamra Custom).
    Room and meal become free, an approver (MD Sir or GM Sir) and a reason are recorded,
    and the value given away is kept for the report. Works through kamra_custom.complimentary. */

import { useCallback, useEffect, useState } from "react"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { fmtMoney } from "../lib/money"
import { useT } from "../lib/i18n"

interface Status {
  complimentary: boolean
  approver: string | null
  reason: string | null
  value: number
  can_mark: boolean
  can_undo: boolean
  approvers: string[]
}

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

function message(e: unknown): string {
  try {
    const body = JSON.parse((e as { body?: string }).body ?? "")
    const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
    return msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || "That did not work."
  } catch {
    return "That did not work."
  }
}

export function ComplimentaryBox({ reservation, onChanged }: { reservation: string; onChanged: () => void }) {
  const { t } = useT()
  const [s, setS] = useState<Status | null>(null)
  const [on, setOn] = useState(false)
  const [approver, setApprover] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    call<Status>("kamra_custom.complimentary.status", { reservation }).then(setS).catch(() => setS(null))
  }, [reservation])
  useEffect(load, [load])

  async function act(method: string, args: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      await call(`kamra_custom.complimentary.${method}`, { reservation, ...args })
      setOn(false)
      setReason("")
      load()
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  if (!s || (!s.complimentary && !s.can_mark)) return null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm" aria-label={t("Complimentary stay")}>
      {s.complimentary ? (
        <div className="space-y-1">
          <p className="font-semibold text-emerald-800">{t("Complimentary stay")}</p>
          <p className="text-zinc-600">
            {t("Room and meal are free. Approved by {who}.", { who: s.approver ?? "" })} {s.reason}
          </p>
          <p className="text-zinc-500">{t("Value given: {v}", { v: fmtMoney(s.value) })}</p>
          {s.can_undo ? (
            <Button variant="outline" disabled={busy} onClick={() => act("unmark", {})}>{t("Undo complimentary")}</Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            {t("Complimentary stay: room and meal free")}
          </label>
          {on ? (
            <div className="space-y-2">
              <div>
                <label className={label} htmlFor="comp-approver">{t("Approved by")}</label>
                <select id="comp-approver" className={field} value={approver} onChange={(e) => setApprover(e.target.value)}>
                  <option value="">{t("Choose…")}</option>
                  {s.approvers.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="comp-reason">{t("Why")}</label>
                <input id="comp-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <Button disabled={busy || !approver || !reason.trim()} onClick={() => act("mark", { approver, reason })}>
                {t("Make complimentary")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {error ? <p role="alert" className="mt-2 text-rose-700">{error}</p> : null}
    </div>
  )
}
