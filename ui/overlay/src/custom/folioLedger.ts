/*  Folio ledger (Kamra Custom): every payment with its time, kind, reference and cashier, and the
    figures for the strip at the top of the bill. Reads what Kamra's bill already returns: each
    payment row carries `creation` (when it was posted) and `owner` (who posted it). */

export interface LedgerPayment {
  payment_kind?: string | null
  posting_date: string
  mode: string
  amount: number
  reference: string | null
  creation?: string | null
  owner?: string | null
}

export interface LedgerCharge {
  charge_type: string
  amount: number
  total: number
}

export interface LedgerRow {
  key: string
  when: string // "2026-11-18 16:10" or the posting date alone
  sortKey: string
  kind: string
  mode: string
  reference: string
  cashier: string
  amount: number
}

export type LedgerGroup = "time" | "mode"

/** "2026-11-18 16:10:03.123" -> "2026-11-18 16:10"; no time -> the posting date. */
export function when(p: Pick<LedgerPayment, "creation" | "posting_date">): string {
  const c = p.creation ? String(p.creation) : ""
  return c.length >= 16 ? c.slice(0, 16).replace("T", " ") : p.posting_date
}

/** A user id such as "front.desk@hotel.com" reads as "front.desk"; "Administrator" stays. */
export function cashierName(owner?: string | null): string {
  if (!owner) return ""
  const at = owner.indexOf("@")
  return at > 0 ? owner.slice(0, at) : owner
}

export function ledgerRows(payments: LedgerPayment[]): LedgerRow[] {
  return payments
    .map((p, i) => ({
      key: `${i}`,
      when: when(p),
      sortKey: `${p.creation ?? p.posting_date}#${String(i).padStart(4, "0")}`,
      kind: p.payment_kind || "Payment",
      mode: p.mode,
      reference: p.reference ?? "",
      cashier: cashierName(p.owner),
      amount: Number(p.amount) || 0,
    }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
}

export interface LedgerSection {
  label: string
  rows: LedgerRow[]
  total: number
}

/** One section for time order, or one per payment mode with its subtotal. */
export function sections(rows: LedgerRow[], by: LedgerGroup): LedgerSection[] {
  if (by === "time") return [{ label: "", rows, total: sum(rows) }]
  const out: LedgerSection[] = []
  const seen = new Map<string, LedgerSection>()
  for (const r of rows) {
    let s = seen.get(r.mode)
    if (!s) {
      s = { label: r.mode, rows: [], total: 0 }
      seen.set(r.mode, s)
      out.push(s)
    }
    s.rows.push(r)
    s.total += r.amount
  }
  return out
}

const sum = (rows: LedgerRow[]) => rows.reduce((n, r) => n + r.amount, 0)

export interface Strip {
  charges: number
  discount: number
  paid: number
  balance: number
  tone: "owing" | "settled" | "advance"
}

/** Discounts are the folio's "Allowance" lines, which Kamra's bill calls a discount. Charges
    are what was billed before them. */
export function strip(
  charges: LedgerCharge[],
  paid: number,
  balance: number,
): Strip {
  let billed = 0
  let discount = 0
  for (const c of charges) {
    if (c.charge_type === "Allowance") discount += Number(c.total) || 0
    else billed += Number(c.total) || 0
  }
  const b = Math.round(balance * 100) / 100
  return {
    charges: billed,
    discount,
    paid,
    balance: b,
    tone: b > 0 ? "owing" : b < 0 ? "advance" : "settled",
  }
}
