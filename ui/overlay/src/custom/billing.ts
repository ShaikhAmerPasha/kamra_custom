/*  Billing and analysis details of a stay (Kamra Custom): how the guest pays, tax exemption, GST and
    PAN, credit limit, guaranteed, special guest, business source and domicile. The same checks as
    the server, so the desk sees a problem before it presses save. Free of React. */

export interface Billing {
  pay_by: string
  tax_exempt: boolean
  gst_number: string
  pan_number: string
  credit_limit: string
  guaranteed: boolean
  special_guest: boolean
  business_source: string
  domicile: string
}

export const PAY_BY = ["Cash", "Card", "UPI", "Bank transfer", "Company", "Credit"] as const

export const EMPTY_BILLING: Billing = {
  pay_by: "", tax_exempt: false, gst_number: "", pan_number: "", credit_limit: "",
  guaranteed: false, special_guest: false, business_source: "", domicile: "",
}

const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** The first thing wrong with the form, or "" when it can be sent. */
export function billingProblem(b: Billing): string {
  const gst = b.gst_number.trim().toUpperCase()
  const pan = b.pan_number.trim().toUpperCase()
  if (gst && !GST.test(gst)) return "The GST number must have 15 letters and digits, like 33ABCDE1234F1Z5."
  if (pan && !PAN.test(pan)) return "The PAN must have 10 characters, like ABCDE1234F."
  const limit = b.credit_limit.trim()
  if (limit && (Number.isNaN(Number(limit)) || Number(limit) < 0)) return "Credit limit must be a number, not below 0."
  return ""
}

/** What a new booking sends: only what the desk filled in, so an untouched form sends nothing. */
export function billingArgs(b: Billing): Record<string, string | number> | undefined {
  const out: Record<string, string | number> = {}
  if (b.pay_by) out.pay_by = b.pay_by
  if (b.tax_exempt) out.tax_exempt = 1
  if (b.gst_number.trim()) out.gst_number = b.gst_number.trim().toUpperCase()
  if (b.pan_number.trim()) out.pan_number = b.pan_number.trim().toUpperCase()
  if (b.credit_limit.trim()) out.credit_limit = Number(b.credit_limit)
  if (b.guaranteed) out.guaranteed = 1
  if (b.special_guest) out.special_guest = 1
  if (b.business_source.trim()) out.business_source = b.business_source.trim()
  if (b.domicile.trim()) out.domicile = b.domicile.trim()
  return Object.keys(out).length ? out : undefined
}

/** Server values (0/1, numbers) into the form's own shapes. */
export function billingFromServer(v: Record<string, unknown>): Billing {
  return {
    pay_by: String(v.pay_by ?? ""), tax_exempt: !!Number(v.tax_exempt), gst_number: String(v.gst_number ?? ""),
    pan_number: String(v.pan_number ?? ""), credit_limit: Number(v.credit_limit) ? String(v.credit_limit) : "",
    guaranteed: !!Number(v.guaranteed), special_guest: !!Number(v.special_guest),
    business_source: String(v.business_source ?? ""), domicile: String(v.domicile ?? ""),
  }
}

/** Every field, for saving over a stay (a cleared box must clear the field). */
export function billingSave(b: Billing): Record<string, string | number> {
  return {
    pay_by: b.pay_by, tax_exempt: b.tax_exempt ? 1 : 0, gst_number: b.gst_number.trim().toUpperCase(),
    pan_number: b.pan_number.trim().toUpperCase(), credit_limit: b.credit_limit.trim() ? Number(b.credit_limit) : 0,
    guaranteed: b.guaranteed ? 1 : 0, special_guest: b.special_guest ? 1 : 0,
    business_source: b.business_source.trim(), domicile: b.domicile.trim(),
  }
}

export const sameBilling = (a: Billing, b: Billing) => JSON.stringify(billingSave(a)) === JSON.stringify(billingSave(b))

export interface AuditLine {
  reserved_by: string | null
  reserved_on: string
  amended_by: string | null
  amended_on: string | null
  checked_in_by: string | null
  checked_in_on: string | null
  checked_out_on: string | null
}

const when = (s: string) => s.slice(0, 16).replace("T", " ")

/** MyCloud's footer: Reserved, Last amended, Checked in, Checked out. */
export function auditParts(a: AuditLine): [string, string][] {
  const who = (name: string | null, on: string | null) => (on ? `${name ? name + " / " : ""}${when(on)}` : "")
  return [
    ["Reserved", who(a.reserved_by, a.reserved_on)],
    ["Last amended", who(a.amended_by, a.amended_on)],
    ["Checked in", who(a.checked_in_by, a.checked_in_on)],
    ["Checked out", a.checked_out_on ? when(a.checked_out_on) : ""],
  ]
}
