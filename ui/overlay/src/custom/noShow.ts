/*  Marking a missed arrival as no-show at the desk (Kamra Custom). Kamra works out the fee and the credit
    (`night_audit.no_show_preview`); these lines only say it in words. */

export interface NoShowPreview {
  reservation: string
  guest_name: string
  check_in_date: string
  fee: string
  fee_reason?: string
  fee_amount: number
  fee_total: number
  paid: number
  credit_after: number
  credit_default: string
}

/** What the policy charges, or why it charges nothing. `money` formats an amount. */
export function feeLine(p: NoShowPreview, money: (n: number) => string): string {
  if (p.fee === "charge" && p.fee_total > 0) return `The no-show policy charges ${money(p.fee_total)}, tax included.`
  return p.fee_reason ? `No fee: ${p.fee_reason}` : "No fee is charged."
}

/** What happens to money the guest already paid. */
export function creditLine(p: NoShowPreview, money: (n: number) => string): string | null {
  if (!(p.credit_after > 0)) return p.paid > 0 ? `${money(p.paid)} paid is used for the fee.` : null
  const how = String(p.credit_default).toLowerCase() === "keep" ? "kept as credit" : "refunded"
  return `${money(p.credit_after)} of what the guest paid is left. The property default is ${how}; settle it from the folio.`
}

/** Why the button cannot be used yet, or "". */
export function noShowBlock(canNoShow: boolean | undefined): string {
  return canNoShow === false ? "Kamra allows a no-show only up to the business date. Run the night audit first." : ""
}
