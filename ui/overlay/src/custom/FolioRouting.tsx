/*  Folio routing of a booking (Kamra Custom): one line on the booking panel that opens the rules in a
    pop-up. Rules are saved on the booking; "Move charges now" applies them with Kamra's own folio
    transfer, and a charge posted later is moved the next time the desk presses it. */

import { useCallback, useEffect, useState } from "react"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { fmtMoney } from "../lib/money"
import { DeskPopup } from "./DeskPopup"
import {
  TARGET_LABELS, emptyRule, movedTold, ruleLine, rulesFromServer, rulesProblem, rulesToServer, routingSummary, sameRules,
  type MoveResult, type PendingCharge, type Rule,
} from "./folioRouting"

interface Data {
  editable: boolean
  has_company: boolean
  in_group: boolean
  charge_types: string[]
  targets: string[]
  routes: Partial<Rule>[]
  pending: PendingCharge[]
}

const errText = (e: unknown) => {
  try {
    const body = JSON.parse((e as { body?: string }).body ?? "")
    const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
    return msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || "That did not work."
  } catch {
    return "That did not work."
  }
}
const input = "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm"

export function FolioRouting({ name, onChanged }: { name: string; onChanged: () => void }) {
  const [d, setD] = useState<Data | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [saved, setSaved] = useState<Rule[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [told, setTold] = useState<{ text: string; lines: MoveResult[] } | null>(null)

  const load = useCallback(() => {
    call<Data>("kamra_custom.routing.get", { reservation: name })
      .then((x) => {
        const r = rulesFromServer(x.routes)
        setD(x)
        setRules(r)
        setSaved(r)
      })
      .catch(() => setD(null))
  }, [name])
  useEffect(load, [load])

  if (!d) return null
  const problem = rulesProblem(rules, { hasCompany: d.has_company, inGroup: d.in_group })
  const changed = !sameRules(rules, saved)
  const patch = (i: number, p: Partial<Rule>) => setRules((all) => all.map((r, k) => (k === i ? { ...r, ...p } : r)))

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await fn()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  const save = () =>
    run(async () => {
      const x = await call<Data>("kamra_custom.routing.save", { reservation: name, routes: rulesToServer(rules) })
      const r = rulesFromServer(x.routes)
      setD(x)
      setRules(r)
      setSaved(r)
      setTold(null)
    })
  const apply = () =>
    run(async () => {
      const out = await call<{ results: MoveResult[]; done: number; failed: number }>("kamra_custom.routing.apply", { reservation: name })
      setTold({ text: movedTold(out.done, out.failed), lines: out.results })
      load()
      onChanged()
    })

  return (
    <div className="rounded border border-zinc-200 bg-white p-2" aria-label="Folio routing">
      <DeskPopup title="Folio routing" summary={routingSummary(saved, d.pending.length)} addLabel="Add" wide>
        <p className="text-xs text-zinc-600">
          Say where a kind of charge goes for this booking. Saving moves nothing; "Move charges now" moves the charges already posted. Kamra's company and group rules still apply first.
        </p>
        <table className="w-full text-sm" aria-label="Routing rules">
          <thead>
            <tr className="text-left text-xs text-zinc-500"><th className="py-1">Charge</th><th>Goes to</th><th>From</th><th>To</th><th /></tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i}>
                <td className="pr-1">
                  <select aria-label="Charge" className={input} value={r.charge_type} disabled={!d.editable} onChange={(e) => patch(i, { charge_type: e.target.value })}>
                    <option value="" />
                    {d.charge_types.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="pr-1">
                  <select aria-label="Goes to" className={input} value={r.target} disabled={!d.editable} onChange={(e) => patch(i, { target: e.target.value })}>
                    {d.targets.map((t) => <option key={t} value={t}>{TARGET_LABELS[t] ?? t}</option>)}
                  </select>
                </td>
                <td className="pr-1"><input aria-label="From date" type="date" className={input} value={r.date_from} disabled={!d.editable} onChange={(e) => patch(i, { date_from: e.target.value })} /></td>
                <td className="pr-1"><input aria-label="To date" type="date" className={input} value={r.date_to} disabled={!d.editable} onChange={(e) => patch(i, { date_to: e.target.value })} /></td>
                <td><button type="button" className="text-xs underline" disabled={!d.editable} onClick={() => setRules((all) => all.filter((_, k) => k !== i))}>Remove</button></td>
              </tr>
            ))}
            {!rules.length ? <tr><td colSpan={5} className="py-2 text-zinc-500">No rules: charges go where Kamra puts them.</td></tr> : null}
          </tbody>
        </table>
        {d.editable ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRules((all) => [...all, emptyRule()])}>Add a rule</Button>
            <Button disabled={busy || !changed || problem !== ""} onClick={save}>Save rules</Button>
            <Button variant="outline" disabled={busy || changed || d.pending.length === 0} onClick={apply} title={changed ? "Save the rules first" : undefined}>
              {busy ? "Working…" : `Move charges now (${d.pending.length})`}
            </Button>
          </div>
        ) : <p className="text-xs text-zinc-500">This booking is closed, so its routing can no longer change.</p>}
        {problem ? <p role="alert" className="text-rose-700">{problem}</p> : null}
        {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
        {!problem && !error && d.pending.length ? (
          <ul className="max-h-28 overflow-auto text-xs text-zinc-700" aria-label="Charges not routed yet">
            {d.pending.map((p) => <li key={p.row}>{p.description || p.charge_type} · {p.stay_date || "-"} · {fmtMoney(p.amount)} · on {TARGET_LABELS[p.from_type] ?? p.from_type}, rule says {TARGET_LABELS[p.target] ?? p.target}</li>)}
          </ul>
        ) : null}
        {told ? (
          <div role="status" className="text-sm">
            <p className="font-medium">{told.text}</p>
            <ul>{told.lines.filter((l) => !l.ok).map((l, i) => <li key={i} className="text-rose-700">✗ {l.charge} {l.stay_date}: {l.message}</li>)}</ul>
          </div>
        ) : null}
        {saved.length ? <p className="text-xs text-zinc-500">{rulesToServer(saved).map((r) => ruleLine(r as unknown as Rule)).join(" · ")}</p> : null}
      </DeskPopup>
    </div>
  )
}
