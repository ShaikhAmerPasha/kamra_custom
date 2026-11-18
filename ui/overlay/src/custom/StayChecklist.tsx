/*  A short checklist at the top of the check-in and check-out panels (Kamra Custom). */

import { useEffect, useState } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"
import { call } from "../lib/api"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import type { CheckItem } from "./stayChecks"
import type { DetailInput } from "./stayDetails"

export interface StayInfo {
  idMissing: boolean
  due: number
  paid: number
  /** The reservation as Kamra returns it, for the stay details card. */
  detail: DetailInput & { folio_name?: string | null }
}

/** What the reservation says about ID and money. Null until it is known. */
export function useStayInfo(reservation: string): StayInfo | null {
  const [info, setInfo] = useState<StayInfo | null>(null)
  useEffect(() => {
    let live = true
    call<{ warnings?: { id_document_missing?: boolean }; money?: { due?: number; paid?: number } } & StayInfo["detail"]>(
      "kamra.api.reservation_detail",
      { reservation },
    )
      .then(
        (d) =>
          live &&
          setInfo({
            idMissing: !!d.warnings?.id_document_missing,
            due: Number(d.money?.due ?? 0),
            paid: Number(d.money?.paid ?? 0),
            detail: d,
          }),
      )
      .catch(() => {})
    return () => {
      live = false
    }
  }, [reservation])
  return info
}

export function StayChecklist(props: {
  items: CheckItem[]
  mode: "in" | "out"
  money: (n: number) => string
}) {
  const { t } = useT()
  const text = (i: CheckItem): string => {
    switch (i.key) {
      case "bill":
        return i.ok ? t("Bill settled") : t("To collect {amount}", { amount: props.money(i.amount ?? 0) })
      case "balance":
        return i.ok ? t("Nothing due now") : t("Balance due {amount}", { amount: props.money(i.amount ?? 0) })
      case "deposit":
        return i.ok ? t("Paid so far {amount}", { amount: props.money(i.amount ?? 0) }) : t("No advance or deposit paid")
      case "folios":
        return t("{n} bills still open", { n: i.count ?? 0 })
      case "id":
        // at check-out the check is for the scanned ID document; at check-in it is for the ID itself
        return props.mode === "out" ? (i.ok ? t("ID scan on file") : t("No ID scan on file")) : i.ok ? t("ID on file") : t("No ID on file")
    }
  }
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm" aria-label={t("Before you continue")}>
      {props.items.map((i) => (
        <li key={i.key} className={cn("flex items-center gap-1.5", i.ok ? "text-emerald-700" : i.key === "deposit" ? "text-zinc-600" : "text-amber-700")}>
          {i.ok ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
          <span>{text(i)}</span>
        </li>
      ))}
    </ul>
  )
}
