/*  Extra charges at check-out (Kamra Custom): the sum the guest will owe for an item, with the GST on
    top of its amount. Pure: the form passes what was typed. */

export interface ExtraLine {
  description: string
  amount: string
  gst: string
}

const num = (s: string): number => {
  const n = Number(String(s).replace(/,/g, "").trim())
  return isFinite(n) ? n : NaN
}

const paise = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** The GST and the total for an amount and a GST percentage. NaN-free: an empty or bad field counts as 0. */
export function lineTotals(amount: string, gst: string): { net: number; gst: number; total: number } {
  const a = num(amount)
  const g = num(gst)
  const net = isFinite(a) && a > 0 ? a : 0
  const rate = isFinite(g) && g > 0 ? g : 0
  const tax = paise((net * rate) / 100)
  return { net: paise(net), gst: tax, total: paise(net + tax) }
}

/** Why this line cannot be added yet, or "" when it can. Rates must be ones the country allows. */
export function lineProblem(l: ExtraLine, allowedRates: number[]): string {
  if (!l.description.trim()) return "Name the charge."
  const a = num(l.amount)
  if (!isFinite(a) || a <= 0) return "Enter an amount above zero."
  const g = l.gst.trim() === "" ? 0 : num(l.gst)
  if (!isFinite(g) || g < 0) return "Enter the GST percentage."
  if (allowedRates.length && !allowedRates.some((r) => Math.abs(r - g) < 1e-9))
    return `GST of ${g}% is not allowed. Use one of: ${allowedRates.join(", ")}.`
  return ""
}

export const toPayload = (l: ExtraLine) => ({
  description: l.description.trim(),
  amount: num(l.amount),
  gst_rate: l.gst.trim() === "" ? 0 : num(l.gst),
})
