// When the one-page check-out can be used. Anything unusual goes to Kamra's own steps.

export interface CheckoutLike {
  reservation: { status: string; company: string | null }
  actions: { can_check_out_role: boolean }
  early_departure: unknown | null
  late_checkout: { late: boolean; already_charged: boolean } | null
  city_ledger: unknown[]
  credit: { blocked: boolean } | null
  refunds: unknown[]
  pending_bills: unknown[]
  /** Blockers the payment itself clears (step "settle") do not count. */
  blockers: { step?: string }[]
  pin_required: boolean
  deposit: { held: number } | null
  collect: { amount: number }[]
  till_open: boolean
  companions: unknown[]
}

/** Reason the plain steps are needed, or "" when the one page is fine. */
export function whyNotExpress(c: CheckoutLike): string {
  if (c.reservation.status !== "Checked In") return "not in house"
  if (!c.actions.can_check_out_role) return "role"
  if (c.early_departure) return "early departure"
  if (c.late_checkout?.late && !c.late_checkout.already_charged) return "late check-out"
  if (c.reservation.company || c.city_ledger.length) return "company bill"
  if (c.credit?.blocked) return "credit"
  if (c.refunds.length) return "refund"
  if (c.pending_bills.length) return "bills not on the folio"
  if (c.blockers.some((b) => b.step !== "settle")) return "blocker"
  if (c.pin_required) return "till PIN"
  if (c.deposit && c.deposit.held > 0) return "security deposit"
  if (c.companions.length) return "group"
  if (c.collect.some((x) => x.amount > 0) && !c.till_open) return "till closed"
  return ""
}
