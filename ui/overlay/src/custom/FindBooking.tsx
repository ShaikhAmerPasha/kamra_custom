/*  Cancel or amend a booking (Kamra Custom): a search by guest name, mobile number or
    booking number, then Kamra's own booking panel, which already holds the cancel
    flow (with its fee rules) and the stay-date amend. Nothing is re-implemented here:
    this is the way in from the menu. */

import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Search } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Sheet } from "../components/ui/sheet"
import { useT } from "../lib/i18n"
import ReservationDetail from "../screens/ReservationDetail"

interface Found {
  name: string
  guest_name: string
  phone: string | null
  status: string
  check_in_date: string
  check_out_date: string
  room_type: string | null
  room: string | null
  adults: number
  children: number
}

const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

export default function FindBooking() {
  const { t } = useT()
  const { action } = useParams()
  const mode = action === "amend" ? "amend" : "cancel"
  const property = getCurrentProperty()
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Found[]>([])
  const [open, setOpen] = useState<Found | null>(null)
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      call<Found[]>("kamra_custom.reservations.find_to_act_on", { action: mode, property, q })
        .then((r) => live && (setRows(r), setFailed(false)))
        .catch(() => live && setFailed(true))
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [mode, property, q, tick])

  const title = mode === "cancel" ? t("Cancel a booking") : t("Amend a booking")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-xs text-zinc-500">
          {mode === "cancel"
            ? t("Find the booking, then cancel it. The hotel's cancellation rules and fee apply.")
            : t("Find the booking, then change its dates, room or rate.")}
        </p>
      </div>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-400" aria-hidden />
        <input
          autoFocus
          aria-label={t("Guest name, mobile number or booking number")}
          className={`${input} pl-9`}
          placeholder={t("Guest name, mobile number or booking number")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {failed ? <p role="alert" className="text-sm text-rose-700">{t("The search did not work. Try again.")}</p> : null}
      <p className="text-xs text-zinc-500">{q.trim() ? t("{n} found", { n: rows.length }) : t("Next arrivals")}</p>
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {rows.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => setOpen(r)}
            className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50"
          >
            <span>
              <span className="block text-sm font-semibold">{r.guest_name} <span className="font-normal text-zinc-500">· {r.name}</span></span>
              <span className="block text-xs text-zinc-500">
                {r.check_in_date} → {r.check_out_date} · {r.room_type ?? ""} · {r.room ? t("Room {n}", { n: r.room }) : t("Room not assigned yet")} · {r.adults + r.children} {t("guests")}
                {r.phone ? ` · ${r.phone}` : ""}
              </span>
            </span>
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs">{r.status}</span>
          </button>
        ))}
        {rows.length === 0 && !failed ? <p className="px-4 py-6 text-center text-sm text-zinc-500">{t("No booking found.")}</p> : null}
      </div>
      {open ? (
        <Sheet wide title={open.name} onClose={() => setOpen(null)}>
          <ReservationDetail row={{ ...open }} reload={() => setTick((n) => n + 1)} onClose={() => setOpen(null)} />
        </Sheet>
      ) : null}
    </div>
  )
}
