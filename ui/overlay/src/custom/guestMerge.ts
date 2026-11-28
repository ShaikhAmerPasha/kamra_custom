/*  Joining duplicate guest profiles (Kamra Custom). The server finds the groups and does the merge
    (`kamra_custom.guest_merge`); these helpers only decide what the screen says. */

export interface DupMember {
  name: string
  full_name: string
  phone: string
  email: string
  stays: number
  last_stay: string
  vip: number
  blacklisted: number
}

export interface DupGroup {
  members: DupMember[]
  keep: string
  can_merge: boolean
  blocked: string
}

/** The profiles that will be removed when `keep` is kept. */
export function toRemove(group: DupGroup, keep: string): DupMember[] {
  return group.members.filter((m) => m.name !== keep)
}

export function bookingsMoving(group: DupGroup, keep: string): number {
  return toRemove(group, keep).reduce((n, m) => n + m.stays, 0)
}

/** The sentence on the confirm step. */
export function confirmText(group: DupGroup, keep: string): string {
  const gone = toRemove(group, keep)
  const kept = group.members.find((m) => m.name === keep)
  const n = bookingsMoving(group, keep)
  const who = gone.map((m) => `${m.name}${m.phone ? ` (${m.phone})` : ""}`).join(", ")
  const moved = n === 0 ? "No bookings move." : n === 1 ? "1 booking moves." : `${n} bookings move.`
  return `${who} will be joined into ${kept?.name ?? keep}${kept?.phone ? ` (${kept.phone})` : ""}. ${moved} What the kept profile lacks (email, ID, address) is filled from the others. This cannot be undone.`
}

export const reasonOk = (reason: string): boolean => reason.trim().length >= 3
