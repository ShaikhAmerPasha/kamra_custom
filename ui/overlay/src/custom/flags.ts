/* Which of our screen changes are switched on (Kamra Custom Settings). Read once. */

import { useEffect, useState } from "react"
import { call } from "../lib/api"

export interface Flags {
  grc_staff_name: boolean
  checkout_date_on_booking: boolean
  merge_meal_in_room_line: boolean
  express_checkin: boolean
  clean_rooms_only: boolean
}

const ON: Flags = { grc_staff_name: true, checkout_date_on_booking: true, merge_meal_in_room_line: false, express_checkin: false, clean_rooms_only: false }
let loaded: Promise<Flags> | null = null

export function useFlags(): Flags {
  const [flags, setFlags] = useState<Flags>(ON)
  useEffect(() => {
    loaded ??= call<Flags>("kamra_custom.flags.ui_flags").catch(() => ON)
    let alive = true
    loaded.then((f) => alive && setFlags({ ...ON, ...f }))
    return () => {
      alive = false
    }
  }, [])
  return flags
}
