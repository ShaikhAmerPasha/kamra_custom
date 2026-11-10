/*  The top of the reservation panel (Kamra Custom): what is ready, what is missing, and the next action.
    Check in shows even before a room is assigned, because check-in picks the room.
    The main button carries data-hk so F4 / F7 press this one, not a second button. */

import { Check, LogIn, LogOut, X } from "lucide-react"
import type { ReservationDetail } from "../lib/api"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { stayChecklist, stayNext } from "./stayBar"

export function StayBar(props: {
  d: ReservationDetail
  busy: boolean
  onCheckIn: () => void
  onCheckOut: () => void
}) {
  const { t } = useT()
  const { d } = props
  const today = new Date().toISOString().slice(0, 10)
  const items = stayChecklist({
    status: d.status,
    room: d.room_number,
    idMissing: !!(d as { warnings?: { id_document_missing?: boolean } }).warnings?.id_document_missing,
    paid: d.money?.paid ?? 0,
    due: d.money?.due ?? 0,
  })
  const next = stayNext({
    status: d.status,
    checkIn: d.check_in_date,
    today,
    canCheckOut: !!(d as { actions?: { can_check_out?: boolean } }).actions?.can_check_out,
  })
  if (!items.length && !next) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span
            key={i.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              i.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
            )}
          >
            {i.ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
            {t(i.label)}
          </span>
        ))}
      </div>
      {next === "checkin" && (
        <button
          type="button"
          data-hk=""
          disabled={props.busy}
          onClick={props.onCheckIn}
          className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <LogIn className="size-4" aria-hidden /> {t("Check in")}
        </button>
      )}
      {next === "checkout" && (
        <button
          type="button"
          data-hk=""
          disabled={props.busy}
          onClick={props.onCheckOut}
          className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden /> {t("Check out")}
        </button>
      )}
    </div>
  )
}
