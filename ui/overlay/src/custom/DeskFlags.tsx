/*  The flags on an arrivals, in-house or departures row (Kamra Custom). */

import { Badge } from "../components/ui/badge"
import { useT } from "../lib/i18n"
import type { Flag } from "./deskRows"

export function DeskFlags(props: { flags: Flag[] }) {
  const { t } = useT()
  if (!props.flags.length) return <span className="text-zinc-300">-</span>
  return (
    <div className="flex flex-wrap gap-1">
      {props.flags.map((f) => (
        <Badge key={f.key} tone={f.tone}>
          {t(f.label)}
        </Badge>
      ))}
    </div>
  )
}
