/*  The notice shown on every screen when the night audit has not caught up with the calendar (Kamra Custom). */

export interface AuditStatus {
  behind: number
  business_date: string
  today: string
}

/** Text for the notice, or null when the audit is up to date or the answer is missing. */
export function auditNotice(s: AuditStatus | null | undefined): { text: string; date: string } | null {
  if (!s || !(s.behind > 0)) return null
  const days = s.behind === 1 ? "1 day" : `${s.behind} days`
  return {
    date: s.business_date,
    text: `The night audit is ${days} behind. Room charges for the nights since the business date are not posted yet, so folios, revenue and balances are short.`,
  }
}

/** The notice is not shown on the night audit screen itself. */
export function showOnPath(pathname: string): boolean {
  return !pathname.startsWith("/end-of-day")
}
