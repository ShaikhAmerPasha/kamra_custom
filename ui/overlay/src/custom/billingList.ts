/* The Billing list (Kamra Custom): the rows the server sends, and small helpers for the screen. */

export interface BillFolio {
  name: string
  type: string
  status: string
  invoice_number: string
  amount: number
  balance: number
}

export interface BillRow {
  key: string
  reservation: string | null
  guest: string
  check_in: string
  check_out: string
  bill_date: string
  amount: number
  paid: number
  balance: number
  payment_modes: string
  booked_through: string
  booking_id: string
  status: "Open" | "Closed"
  folios: BillFolio[]
}

/** Where the bill opens: the page for one folio. */
export const folioPath = (folio: string) => `/billing/${encodeURIComponent(folio)}`

/** Opens the folio and starts the browser's print box, where "Save as PDF" makes the file. */
export const pdfPath = (folio: string) => `${folioPath(folio)}?print=1`

/** Why the dates cannot be used, or "". Both dates are YYYY-MM-DD, or empty. */
export function rangeProblem(from: string, to: string): string {
  return from && to && from > to ? "The From date is after the To date." : ""
}

/** "2 folios" for a stay with more than one, else the folio's own type. */
export function foliosLabel(row: Pick<BillRow, "folios">): string {
  return row.folios.length > 1 ? `${row.folios.length} folios` : ""
}
