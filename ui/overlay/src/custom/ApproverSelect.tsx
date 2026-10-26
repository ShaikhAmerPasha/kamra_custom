/* "Rate approved by": a short list (MD Sir, GM Sir, Front Office ...) with + Create new for a
   manager. The list is kept by the hotel (Rate Approver). */

import { useEffect, useState } from "react"
import { call } from "../lib/api"

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
const NEW = "__new__"

interface Listing {
  approvers: string[]
  can_create: boolean
}

export function ApproverSelect(props: { id: string; value: string; onChange: (v: string) => void; heading?: string }) {
  const { id, value, onChange, heading = "Rate approved by" } = props
  const [list, setList] = useState<Listing>({ approvers: [], can_create: false })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    call<Listing>("kamra_custom.approvers.list_approvers")
      .then((l) => alive && setList(l))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function add() {
    setError("")
    try {
      const out = await call<{ name: string }>("kamra_custom.approvers.create_approver", { name: draft })
      setList((l) => ({ ...l, approvers: l.approvers.includes(out.name) ? l.approvers : [...l.approvers, out.name] }))
      onChange(out.name)
      setAdding(false)
      setDraft("")
    } catch {
      setError("Could not add that name. Use 2 to 40 characters.")
    }
  }

  return (
    <div>
      <label className={label} htmlFor={id}>{heading}</label>
      <select
        id={id}
        className={field}
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setAdding(true)
            return
          }
          setAdding(false)
          onChange(e.target.value)
        }}
      >
        <option value="">Choose...</option>
        {list.approvers.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
        {list.can_create ? <option value={NEW}>+ Create new...</option> : null}
      </select>
      {adding ? (
        <div className="mt-2 flex gap-2">
          <input aria-label="New approver name" className={field} placeholder="Name, for example Owner Madam" value={draft}
            onChange={(e) => setDraft(e.target.value)} />
          <button type="button" className="shrink-0 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={draft.trim().length < 2} onClick={add}>Add</button>
          <button type="button" className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm"
            onClick={() => { setAdding(false); setDraft("") }}>Cancel</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p> : null}
    </div>
  )
}
