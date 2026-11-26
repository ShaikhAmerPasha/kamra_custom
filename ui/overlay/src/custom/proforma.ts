/*  Proforma invoice on screen (Kamra Custom): the lines as the desk wants them summed, the way MyCloud
    offers it: none, by charge, by date, or by date and charge. Free of React. */

export interface PfLine { date: string; code: string; description: string; amount: number; tax_rate: number; tax: number; total: number }
export type SummaryMode = "none" | "charge" | "date" | "date_charge"

export const SUMMARY_MODES: [SummaryMode, string][] = [
  ["none", "None"], ["charge", "Charge"], ["date", "Date"], ["date_charge", "Date and charge"],
]

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** The lines, summed by the chosen key. Sums keep the order the keys first appear, and a summed row has
    no tax rate of its own when its lines differ. */
export function summarise(lines: PfLine[], mode: SummaryMode): PfLine[] {
  if (mode === "none") return lines
  const keyOf = (l: PfLine) => (mode === "charge" ? l.code : mode === "date" ? l.date : `${l.date}|${l.code}`)
  const out = new Map<string, PfLine>()
  for (const l of lines) {
    const k = keyOf(l)
    const cur = out.get(k)
    if (!cur) {
      out.set(k, { ...l, description: mode === "date" ? "All charges" : l.description, code: mode === "date" ? "" : l.code, date: mode === "charge" ? "" : l.date })
    } else {
      cur.amount = r2(cur.amount + l.amount)
      cur.tax = r2(cur.tax + l.tax)
      cur.total = r2(cur.total + l.total)
      if (cur.tax_rate !== l.tax_rate) cur.tax_rate = -1
    }
  }
  return [...out.values()]
}

/** Every stay's lines in one list: a group proforma by charge or date adds rooms together. */
export const allLines = (stays: { lines: PfLine[] }[]) => stays.flatMap((s) => s.lines)

/** A tax rate as printed: blank when a summed row mixes rates. */
export const rateText = (r: number) => (r < 0 ? "" : `${r}%`)

/** The checks that the printed totals tie: lines add up to the figures above them. */
export function totalsTie(lines: PfLine[], total: number): boolean {
  return Math.abs(lines.reduce((s, l) => s + l.total, 0) - total) < 0.05
}
