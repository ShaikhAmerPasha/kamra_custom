/* Registration card (GRC) additions (Kamra Custom): the staff name beside the front desk
   signature, a mark when the guest signed the printed card, and the room category only
   until the guest is checked in. */

import { useEffect, useState } from "react"
import { call } from "../lib/api"
import { useFlags, type Flags } from "./flags"
export { grcRoomLabel, type GrcStay } from "./grcLabel"

export interface GrcExtra {
  staff_name: string
  signed_on_paper: boolean
}

export function useGrc(reservation?: string): { flags: Flags; extra: GrcExtra | null } {
  const flags = useFlags()
  const [extra, setExtra] = useState<GrcExtra | null>(null)
  useEffect(() => {
    if (!reservation || !flags.grc_staff_name) return
    let alive = true
    call<GrcExtra>("kamra_custom.reservations.grc_extra", { reservation })
      .then((x) => alive && setExtra(x))
      .catch(() => alive && setExtra(null))
    return () => {
      alive = false
    }
  }, [reservation, flags.grc_staff_name])
  return { flags, extra }
}

/** Above the guest's signature line: a tick when the guest signed the printed card. */
export function PaperSignMark({ grc, hasImage }: { grc: { flags: Flags; extra: GrcExtra | null }; hasImage: boolean }) {
  if (!grc.flags.grc_staff_name || hasImage || !grc.extra?.signed_on_paper) return null
  return <span className="pb-1 text-sm font-medium text-zinc-700">✓ Signed on the printed card</span>
}

/** Above the front desk signature line: the name of the staff member. */
export function StaffName({ grc }: { grc: { flags: Flags; extra: GrcExtra | null } }) {
  return (
    <div className="flex h-16 items-end justify-center pb-1 text-sm font-medium text-zinc-700">
      {grc.flags.grc_staff_name ? grc.extra?.staff_name : null}
    </div>
  )
}
