/*  The staff note on a booking, shown on the bill and at check-out (Kamra Custom). Notes such as "company pays
    room only" or "cash for extras" were only on the booking screen, so the person closing the bill never saw
    them. Staff only: it is never printed. Shows nothing when there is no note or the read fails. */
import { useEffect, useState } from "react"
import { StickyNote } from "lucide-react"
import { call } from "../lib/api"
import { useT } from "../lib/i18n"

export function BookingNote({ reservation }: { reservation: string | null | undefined }) {
  const { t } = useT()
  const [note, setNote] = useState("")

  useEffect(() => {
    setNote("")
    if (!reservation) return
    let live = true
    call<{ note: string }>("kamra_custom.reservations.booking_note", { reservation })
      .then((r) => live && setNote(r.note || ""))
      .catch(() => undefined)
    return () => { live = false }
  }, [reservation])

  if (!note) return null
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
      <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 whitespace-pre-line"><span className="font-medium">{t("Staff note")}:</span> {note}</p>
    </div>
  )
}
