/* Putting a room out of order asks why and until when (Kamra Custom). Every place that sets a
   room to Out of Order goes through setHousekeepingStatus; it calls askOutOfOrder, and the form
   mounted in the app shell answers. */

export interface OooAnswer {
  reason: string
  until: string
}

const EVENT = "kamra:ask-ooo"
let listening = 0

/** The form in the shell tells that it is there. Without it (a bare screen) the plain call is made. */
export const oooListening = () => listening > 0
export function listenForOutOfOrder(handler: (room: string, answer: (a: OooAnswer | null) => void) => void): () => void {
  const on = (e: Event) => {
    const d = (e as CustomEvent<{ room: string; resolve: (a: OooAnswer | null) => void }>).detail
    handler(d.room, d.resolve)
  }
  window.addEventListener(EVENT, on)
  listening++
  return () => {
    window.removeEventListener(EVENT, on)
    listening--
  }
}

export function askOutOfOrder(room: string): Promise<OooAnswer | null> {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent(EVENT, { detail: { room, resolve } })))
}

/** Why the form cannot be sent yet, or "" when it can. `today` is YYYY-MM-DD. */
export function oooProblem(reason: string, until: string, today: string): string {
  if (reason.trim().length < 3) return "Say why the room is out of order."
  if (!until) return "Say until when the room is out of order."
  if (until < today) return "The date the room is expected back cannot be in the past."
  return ""
}
