/*  Counts which shortcuts, buttons and screens the desk uses (Kamra Custom).
    Only an action name and how often: no guest, no reservation, no amount, no user.
    Sent to the site every minute so we can see what the desk really does most. */

import { call } from "../lib/api"

let counts: Record<string, number> = {}

export function count(action: string) {
  if (action) counts[action] = (counts[action] ?? 0) + 1
}

export async function flush() {
  const batch = counts
  if (!Object.keys(batch).length) return
  counts = {}
  try {
    await call("kamra_custom.usage.log_usage", { counts: JSON.stringify(batch) })
  } catch {
    // keep them for the next try
    for (const [k, v] of Object.entries(batch)) counts[k] = (counts[k] ?? 0) + v
  }
}
