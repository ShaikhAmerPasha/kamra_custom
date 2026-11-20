/*  Mounted once in the app shell (Kamra Custom). Any screen opens the Stay hub by calling
    openStayHub(reservation); the host shows it and, when the desk asks for a check-in or check-out,
    opens Kamra's own panel for that booking. */

import { useEffect, useState } from "react"
import CheckInDialog from "../components/CheckInDialog"
import CheckOutDialog from "../components/CheckOutDialog"
import { Sheet } from "../components/ui/sheet"
import ReservationDetail from "../screens/ReservationDetail"
import { useT } from "../lib/i18n"
import { StayHub } from "./StayHub"
import { HUB_EVENT, type HubTab } from "./stayHub"

export function StayHubHost() {
  const [open, setOpen] = useState<{ reservation: string; tab: HubTab } | null>(null)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const { t } = useT()

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ reservation: string; tab?: HubTab }>).detail
      if (d?.reservation) setOpen({ reservation: d.reservation, tab: d.tab ?? "overview" })
    }
    window.addEventListener(HUB_EVENT, on)
    return () => window.removeEventListener(HUB_EVENT, on)
  }, [])

  return (
    <>
      {open && !checkingIn && !checkingOut && !editing && (
        <StayHub
          reservation={open.reservation}
          tab={open.tab}
          onClose={() => setOpen(null)}
          onCheckIn={(r) => setCheckingIn(r)}
          onCheckOut={(r) => setCheckingOut(r)}
          onEdit={(r) => setEditing(r)}
        />
      )}
      {editing && (
        <Sheet wide title={t("Edit booking")} onClose={() => setEditing(null)}>
          <ReservationDetail row={{ name: editing }} reload={() => {}} onClose={() => setEditing(null)} />
        </Sheet>
      )}
      {checkingIn && (
        <CheckInDialog
          reservation={checkingIn}
          onClose={() => setCheckingIn(null)}
          onDone={() => {
            setCheckingIn(null)
            setOpen(null)
          }}
        />
      )}
      {checkingOut && (
        <CheckOutDialog
          reservation={checkingOut}
          onClose={() => setCheckingOut(null)}
          onDone={() => {
            setCheckingOut(null)
            setOpen(null)
          }}
          onOpenReservation={(name) => setCheckingOut(name)}
        />
      )}
    </>
  )
}
