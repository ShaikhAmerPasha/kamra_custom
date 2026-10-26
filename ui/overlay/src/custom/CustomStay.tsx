/* Check-out date beside Nights when making a reservation (Kamra Custom). The booking
   dialog keeps its own `nights`; this turns a typed check-out date into nights and shows
   the date that nights lead to. */

import type { ComponentType, ReactNode } from "react"
import { useFlags } from "./flags"
import { addDaysISO, isISODate, nightsFromDates } from "./stay"

interface Props {
  checkIn: string
  nights: number
  onNights: (n: number) => void
  Field: ComponentType<{ label: string; children: ReactNode }>
  inputCls: string
  t: (s: string) => string
}

export function StayLength({ checkIn, nights, onNights, Field, inputCls, t }: Props) {
  const { checkout_date_on_booking } = useFlags()
  const nightsBox = (
    <Field label={t("Nights")}>
      <input type="number" min={1} className={inputCls} value={nights} onChange={(e) => onNights(Math.max(1, Number(e.target.value)))} />
    </Field>
  )
  if (!checkout_date_on_booking || !isISODate(checkIn)) return nightsBox
  const checkOut = addDaysISO(checkIn, Math.max(1, nights))
  return (
    <>
      <Field label={t("Check-out")}>
        <input
          type="date"
          className={inputCls}
          aria-label={t("Check-out")}
          min={addDaysISO(checkIn, 1)}
          value={checkOut}
          onChange={(e) => {
            if (isISODate(e.target.value)) onNights(nightsFromDates(checkIn, e.target.value))
          }}
        />
      </Field>
      {nightsBox}
    </>
  )
}
