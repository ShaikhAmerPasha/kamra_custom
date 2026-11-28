/*  "No-show" on a missed arrival (Kamra Custom). Kamra works out the fee and the credit; the desk reads them,
    gives a reason if it wants, and confirms. Uses Kamra's own calls, so the policy is the one the night audit applies. */
import { useState } from "react"
import { call } from "../lib/api"
import { cur } from "../lib/money"
import { useT } from "../lib/i18n"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { showDate } from "./showDate"
import { creditLine, feeLine, noShowBlock, type NoShowPreview } from "./noShow"

const money = (n: number) => `${cur()}${Math.round(n).toLocaleString("en-IN")}`

export function NoShowButton(props: { reservation: string; guest: string; canNoShow?: boolean; onDone: () => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<NoShowPreview | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const block = noShowBlock(props.canNoShow)

  const start = () => {
    setOpen(true)
    setPreview(null)
    setError("")
    setReason("")
    call<NoShowPreview>("kamra.night_audit.no_show_preview", { reservation: props.reservation })
      .then(setPreview)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }
  const confirm = async () => {
    setBusy(true)
    setError("")
    try {
      await call("kamra.night_audit.eod_mark_no_show", { reservation: props.reservation, reason: reason.trim() || undefined })
      setOpen(false)
      props.onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const credit = preview ? creditLine(preview, money) : null

  return (
    <>
      <Button variant="outline" className="whitespace-nowrap px-2.5 py-1 text-xs" disabled={!!block} title={block ? t(block) : t("Mark this arrival as a no-show")} onClick={start}>
        {t("No-show")}
      </Button>
      {open && (
        <Sheet
          title={t("Mark {name} as no-show", { name: props.guest })}
          description={preview ? t("Arrival was due on {date}.", { date: showDate(preview.check_in_date) }) : undefined}
          onClose={() => setOpen(false)}
          footer={
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" className="ms-auto" onClick={() => setOpen(false)}>{t("Keep the booking")}</Button>
              <Button disabled={busy || !preview} onClick={confirm}>{busy ? t("Saving…") : t("Mark no-show")}</Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            {!preview && !error ? <p className="text-zinc-500">{t("Checking the no-show policy…")}</p> : null}
            {preview ? (
              <>
                <p>{t(feeLine(preview, money))}</p>
                {credit ? <p>{t(credit)}</p> : null}
                <p className="text-zinc-500">{t("The room is released at once. The booking can no longer be checked in.")}</p>
                <div>
                  <label htmlFor="noshow-reason" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">{t("Note (optional)")}</label>
                  <textarea id="noshow-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600" />
                </div>
              </>
            ) : null}
            {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
          </div>
        </Sheet>
      )}
    </>
  )
}
