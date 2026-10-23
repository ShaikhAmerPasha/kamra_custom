export interface DirtyRow {
  room: string
  room_number: string
  floor: string | null
  room_type: string | null
  /** Set when the room turned dirty because of this checkout. */
  checked_out_at: string | null
  /** The room's latest checkout of any stay. */
  last_checkout_at: string | null
  dirty_since: string | null
  source: string
  reason: string
  elapsed_minutes: number | null
  task_status: string | null
  assigned_to: string | null
}
export interface DirtyReport {
  property: string
  generated_at: string
  rows: DirtyRow[]
}

/** "2026-10-17 11:42:08.5" -> "11:42". Empty when unknown. */
export const timeOf = (s: string | null) => (s ? s.slice(11, 16) : "")
export const dateOf = (s: string | null) => (s ? s.slice(0, 10) : "")
/** "2026-10-17 11:42". Empty when unknown. */
export const dateTimeOf = (s: string | null) => (s ? `${dateOf(s)} ${timeOf(s)}` : "")

/** Where the report downloads from. The server builds the Excel file. */
export const downloadUrl = (property: string) =>
  `/api/method/kamra_custom.housekeeping.dirty_room_report_xlsx?property=${encodeURIComponent(property)}`
