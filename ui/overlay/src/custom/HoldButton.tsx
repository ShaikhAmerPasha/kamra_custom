/*  A Hold button for the booking dialog (Kamra Custom): keep the room for the guest until a time,
    without confirming. Kamra releases the room by itself when the time runs out. */

import { HOLD_CHOICES } from "./hold"

export function HoldButton(props: {
  choice: string
  onChoice: (v: string) => void
  disabled: boolean
  onHold: () => void
}) {
  return (
    <div className="flex gap-2">
      <select aria-label="Hold for" className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm" value={props.choice} onChange={(e) => props.onChoice(e.target.value)}>
        {HOLD_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button type="button" disabled={props.disabled} onClick={props.onHold}
        title="Keep the room for the guest until then. It is released by itself if the booking is not confirmed."
        className="rounded border border-zinc-300 bg-white px-4 py-1 text-sm font-medium disabled:opacity-50">
        Hold
      </button>
    </div>
  )
}
