import type { ComponentType, ReactNode } from "react"
import { useFlags } from "./flags"
import { clock12, type StayTimes as Times } from "./stayTimes"

/** Arrival and departure time for an overnight stay, next to the dates. */
export function StayTimes(props: {
  times: Times
  onChange: (t: Times) => void
  Field: ComponentType<{ label: string; children: ReactNode }>
  inputCls: string
  t: (s: string) => string
  /** A walk-in always gets a room at once. */
  walkIn?: boolean
}) {
  const { times, onChange, Field, inputCls, t, walkIn } = props
  const flags = useFlags()
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label={t("Arrival time")}>
        <input
          type="time"
          className={inputCls}
          aria-label={t("Arrival time")}
          value={times.arrive}
          onChange={(e) => onChange({ ...times, arrive: e.target.value })}
        />
      </Field>
      <Field label={t("Departure time")}>
        <input
          type="time"
          className={inputCls}
          aria-label={t("Departure time")}
          value={times.depart}
          onChange={(e) => onChange({ ...times, depart: e.target.value })}
        />
      </Field>
      <p className="col-span-2 self-end pb-2 text-xs text-zinc-500">
        {times.arrive || times.depart
          ? `${clock12(times.arrive) || t("Standard time")} to ${clock12(times.depart) || t("standard time")}. `
          : t("Optional. Blank uses the standard check-in and check-out time. ")}
        {flags.assign_room_at_checkin && !walkIn ? t("The room is chosen at check-in.") : t("A room is assigned now.")}
      </p>
    </div>
  )
}
