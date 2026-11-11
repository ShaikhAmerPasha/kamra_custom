import { useEffect, useRef, useState } from "react"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { listenForOutOfOrder, oooProblem, type OooAnswer } from "./outOfOrder"

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** The reason and the return date, asked before a room goes out of order. Mounted once in the shell. */
export function OutOfOrderAsk() {
  const [room, setRoom] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [until, setUntil] = useState("")
  const answer = useRef<((a: OooAnswer | null) => void) | null>(null)
  const today = isoDay(new Date())

  useEffect(
    () =>
      listenForOutOfOrder((r, resolve) => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setReason("")
        setUntil(isoDay(tomorrow))
        answer.current = resolve
        setRoom(r)
      }),
    [],
  )

  if (room === null) return null
  const problem = oooProblem(reason, until, today)
  const close = (a: OooAnswer | null) => {
    answer.current?.(a)
    answer.current = null
    setRoom(null)
  }
  const number = room.split("-").pop()
  return (
    <Sheet
      title={`Room ${number}: out of order`}
      description="Say why, and when the room is expected back. Both are kept on the record."
      onClose={() => close(null)}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="outline" className="ms-auto" onClick={() => close(null)}>Cancel</Button>
          <Button disabled={problem !== ""} onClick={() => close({ reason: reason.trim(), until })}>Put out of order</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="ooo-reason" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Reason (required)</label>
          <textarea id="ooo-reason" rows={3} className={input} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="For example: AC not cooling, water leak, repainting" />
        </div>
        <div>
          <label htmlFor="ooo-until" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Out of order until (required)</label>
          <input id="ooo-until" type="date" min={today} className={input} value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        {problem && (reason !== "" || until === "") ? <p role="status" className="text-sm text-amber-700">{problem}</p> : null}
      </div>
    </Sheet>
  )
}
