/*  The line under the deposit box on the check-in screen (Kamra Custom).
    Kamra's `satisfied` flag is true whenever the property has no deposit policy, even when this stay's own
    deposit row asks for money (a desk-agreed amount, or a policy changed later). So it said "taken" beside
    "Held 0". The line now reads the stay's own deposit. */

export interface SecurityFacts {
  status: string
  required: number
  held: number
  collected?: number
  due?: number
  policy_amount?: number
}

export interface DepositFacts {
  satisfied: boolean
  security: SecurityFacts
}

/** A security deposit row that nobody asked for now: the property takes no security deposit (policy 0) and
    nothing was ever collected, so the row is left over from an earlier setting. A hotel that takes advances
    only (as this one does) must not see it on the check-in screen or the stay. */
export function securityLeftOver(s: SecurityFacts | null | undefined): boolean {
  if (!s) return false
  return s.status === "Required" && typeof s.policy_amount === "number" && s.policy_amount <= 0 && !(Number(s.held) > 0) && !(Number(s.collected) > 0)
}

/** True when the stay's security deposit should be shown at all. */
export function securityInUse(s: SecurityFacts | null | undefined): boolean {
  return !!s && s.status !== "None" && !securityLeftOver(s)
}

export type DepositNotice =
  | { kind: "none" }
  | { kind: "waived" }
  | { kind: "taken"; amount: number }
  | { kind: "due"; amount: number }

const EPS = 0.01

export function depositNotice(d: DepositFacts): DepositNotice {
  const s = d.security
  if (securityLeftOver(s)) return { kind: "none" }
  if (s.status === "Waived") return { kind: "waived" }
  const required = Number(s.required) || 0
  const held = Number(s.held) || 0
  if (s.status !== "None" && required > 0 && held + EPS < required) {
    const due = Number(s.due)
    return { kind: "due", amount: due > EPS ? due : required - held }
  }
  if (held > EPS) return { kind: "taken", amount: held }
  return d.satisfied && required <= 0 ? { kind: "none" } : { kind: "taken", amount: 0 }
}
