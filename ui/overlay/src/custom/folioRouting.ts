/*  Folio routing on a booking (Kamra Custom): the rules the desk edits, the checks that match the
    server's, and the lines told back. Free of React. */

export interface Rule { charge_type: string; target: string; date_from: string; date_to: string }
export interface PendingCharge { folio: string; row: string; charge_type: string; description: string; stay_date: string; amount: number; from_type: string; target: string }

export const TARGET_LABELS: Record<string, string> = {
  Guest: "Guest folio",
  Extra: "Folio #2 (extra)",
  Company: "Company folio",
  Group: "Group bill",
}

export const emptyRule = (): Rule => ({ charge_type: "", target: "Extra", date_from: "", date_to: "" })

export const rulesFromServer = (rows: Partial<Rule>[]): Rule[] =>
  rows.map((r) => ({ charge_type: r.charge_type ?? "", target: r.target ?? "Extra", date_from: r.date_from ?? "", date_to: r.date_to ?? "" }))

/** What is saved: only complete rows, so a half-filled new row is not an error but is not kept. */
export const rulesToServer = (rules: Rule[]) => rules.filter((r) => r.charge_type).map((r) => ({ ...r, date_from: r.date_from || null, date_to: r.date_to || null }))

export const sameRules = (a: Rule[], b: Rule[]) => JSON.stringify(rulesToServer(a)) === JSON.stringify(rulesToServer(b))

/** The first thing wrong, or "". Mirrors routing.clean on the server. */
export function rulesProblem(rules: Rule[], ctx: { hasCompany: boolean; inGroup: boolean }): string {
  const seen = new Set<string>()
  for (const r of rules.filter((x) => x.charge_type)) {
    if (r.date_from && r.date_to && r.date_from > r.date_to) return `${r.charge_type}: the first date is after the last date.`
    const key = `${r.charge_type}|${r.date_from}|${r.date_to}`
    if (seen.has(key)) return `${r.charge_type} has two rules for the same dates.`
    seen.add(key)
    if (r.target === "Company" && !ctx.hasCompany) return "Set the company that pays on the booking first, to route charges to it."
    if (r.target === "Group" && !ctx.inGroup) return "Only a room of a group booking can route charges to the group bill."
  }
  return ""
}

/** The row's own line: "Food & Beverage → Folio #2 (extra), 26/11 to 28/11". */
export function ruleLine(r: Rule): string {
  const day = (d: string) => d.split("-").reverse().slice(0, 2).join("/")
  const when = r.date_from || r.date_to ? `, ${r.date_from ? day(r.date_from) : "start"} to ${r.date_to ? day(r.date_to) : "end"}` : ""
  return `${r.charge_type} → ${TARGET_LABELS[r.target] ?? r.target}${when}`
}

/** The one line on the booking panel. */
export function routingSummary(rules: Rule[], pending: number): string {
  const n = rulesToServer(rules).length
  if (n === 0) return ""
  return `${n} rule${n === 1 ? "" : "s"}${pending ? ` · ${pending} charge${pending === 1 ? "" : "s"} not routed yet` : " · all routed"}`
}

export interface MoveResult { charge: string; stay_date: string; to: string; ok: boolean; message: string }
export function movedTold(done: number, failed: number): string {
  if (failed === 0) return done === 0 ? "Nothing to move." : `${done} moved.`
  return done === 0 ? `None moved. See the reasons below.` : `${done} moved, ${failed} not moved. See the reasons below.`
}
