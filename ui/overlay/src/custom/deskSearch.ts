/*  Find a stay in the In House list (Kamra Custom): by guest, room number, phone, company or booking number.
    Pure: the screen passes the rows and what was typed. */

export interface SearchRow {
  name: string
  guest_name: string
  room: string | null
  phone?: string | null
  company_name?: string | null
}

const digits = (s: string) => s.replace(/\D/g, "")

export function matchesRow(row: SearchRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const room = row.room ? row.room.split("-").pop() ?? "" : ""
  const text = [row.guest_name, row.name, row.company_name ?? "", room].join(" ").toLowerCase()
  if (text.includes(q)) return true
  const d = digits(q)
  // phone: a few digits are enough, however the number was written
  return d.length >= 3 && digits(row.phone ?? "").includes(d)
}

export function filterRows<T extends SearchRow>(rows: T[], query: string): T[] {
  return query.trim() ? rows.filter((r) => matchesRow(r, query)) : rows
}

/** "+91 98…, Bharat Tech" under the guest name; nothing when neither is known. */
export function contactLine(row: { phone?: string | null; company_name?: string | null }): string {
  return [row.phone, row.company_name].filter(Boolean).join(" · ")
}
