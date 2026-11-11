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

// --- paying in more than one way -------------------------------------------------------------

/** Cash, for the screens that still tell it apart. Every payment needs a reference now, cash too. */
export const isCash = (mode: string) => /^cash$/i.test(mode.trim())

export interface Tender {
  mode: string
  /** Blank on the last line means "the rest". */
  amount: string
  reference: string
}

const cents = (n: number) => Math.round(n * 100)

/** What each line pays, with a blank last line taking the rest. */
export function tenderAmounts(lines: Tender[], due: number): number[] {
  const out = lines.map((l) => (l.amount.trim() === "" ? NaN : Number(l.amount)))
  const known = out.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0)
  const last = out.length - 1
  if (last >= 0 && Number.isNaN(out[last])) out[last] = Math.max(0, cents(due) - cents(known)) / 100
  return out
}

/** Why the payments cannot be taken yet, or "" when they can. */
export function tenderProblem(lines: Tender[], due: number): string {
  if (due <= 0.005) return ""
  if (lines.length === 0) return "Choose how the guest pays."
  const amounts = tenderAmounts(lines, due)
  for (let i = 0; i < lines.length; i++) {
    const a = amounts[i]
    if (!Number.isFinite(a) || a <= 0) return "Enter an amount for each payment."
    if (!lines[i].mode) return "Choose how the guest pays."
    if (lines[i].reference.trim() === "") return `Write the reference for the ${lines[i].mode} payment.`
  }
  const total = amounts.reduce((s, a) => s + cents(a), 0)
  if (total > cents(due)) return "The payments are more than the amount to collect."
  if (total < cents(due)) return "The payments are less than the amount to collect."
  return ""
}

export interface Payment {
  folio: string
  mode: string
  amount: number
  reference: string
}

/** Share the payments over the folios that owe money, in order. */
export function allocate(
  payments: { mode: string; amount: number; reference: string }[],
  owes: { folio: string; amount: number }[],
): Payment[] {
  const out: Payment[] = []
  const left = owes.map((o) => ({ ...o, c: cents(o.amount) }))
  let f = 0
  for (const p of payments) {
    let c = cents(p.amount)
    while (c > 0 && f < left.length) {
      const take = Math.min(c, left[f].c)
      if (take > 0) out.push({ folio: left[f].folio, mode: p.mode, amount: take / 100, reference: p.reference })
      c -= take
      left[f].c -= take
      if (left[f].c === 0) f++
    }
  }
  return out
}
