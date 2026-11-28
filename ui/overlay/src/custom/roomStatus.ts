/*  Room cleaning states (Kamra Custom). Kamra stores five: Clean, Dirty, Inspected, Ready, Out of Order.
    "Ready" is what Kamra writes when an inspection passes, so it means the same as "Inspected": cleaned and
    checked. Screens that did not know it showed such a room in white, left it out of the counts and warned
    that it "hasn't been cleaned yet". These helpers say it once. */

/** The word to show for a state. */
export function hkLabel(status: string | null | undefined): string {
  return status === "Ready" ? "Inspected" : status ?? ""
}

/** True when the room has been cleaned: Clean, Inspected or Ready. */
export function hkCleaned(status: string | null | undefined): boolean {
  return status === "Clean" || status === "Inspected" || status === "Ready"
}

/** Counts by state with Ready folded into Inspected. */
export function hkCounts(counts: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = { ...(counts ?? {}) }
  if (out.Ready) {
    out.Inspected = (out.Inspected ?? 0) + out.Ready
    delete out.Ready
  }
  return out
}
