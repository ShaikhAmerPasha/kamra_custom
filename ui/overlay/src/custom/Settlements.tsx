/*  What the guest has settled so far, on the check-out screens (Kamra Custom): each payment with its
    date, mode, reference and amount. Reads kamra_custom.checkout.settlements. */

import { useEffect, useState } from "react"
import { call } from "../lib/api"

interface Line {
  folio: string
  date: string
  mode: string
  amount: number
  reference: string
  kind: string
}

export function Settlements(props: { reservation: string; money: (n: number) => string; version?: number }) {
  const [lines, setLines] = useState<Line[] | null>(null)
  useEffect(() => {
    let alive = true
    call<Line[]>("kamra_custom.checkout.settlements", { reservation: props.reservation })
      .then((x) => alive && setLines(x))
      .catch(() => alive && setLines([]))
    return () => {
      alive = false
    }
  }, [props.reservation, props.version])
  if (!lines || lines.length === 0) return null
  return (
    <section className="space-y-1" data-testid="settlements">
      <h3 className="text-sm font-semibold text-zinc-800">Settlements so far</h3>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-zinc-700">
              {l.date} · {l.mode}
              {l.kind && l.kind !== "Payment" ? <span className="ms-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{l.kind}</span> : null}
              {l.reference ? <span className="ms-2 text-zinc-400">{l.reference}</span> : null}
            </span>
            <span className="tabular-nums">{props.money(l.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
