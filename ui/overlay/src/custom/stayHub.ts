/*  The Stay hub (Kamra Custom): one panel with everything about a booking. This file holds the rules
    that are not drawing: how the panel is opened, which chips sit in the strip, and how a ledger
    entry reads. Pure, so the rules can be tested. */

export const HUB_EVENT = "kamra:stay-hub"

export type HubTab = "overview" | "rates" | "money" | "guest" | "notes" | "history"

export const TABS: { key: HubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "rates", label: "Rates" },
  { key: "money", label: "Money" },
  { key: "guest", label: "Guest and ID" },
  { key: "notes", label: "Notes" },
  { key: "history", label: "History" },
]

/** Ask the hub to open for a booking, from any screen. */
export function openStayHub(reservation: string, tab: HubTab = "overview") {
  if (typeof window === "undefined" || !reservation) return
  window.dispatchEvent(new CustomEvent(HUB_EVENT, { detail: { reservation, tab } }))
}

export type ChipTone = "bad" | "warn" | "ok" | "plain"

export interface Chip {
  key: string
  tone: ChipTone
  /** a translation key, with {placeholders} filled from `vars` */
  label: string
  vars?: Record<string, string | number>
}

const EPS = 0.005
const DAY = 86_400_000

/** Whole days from `from` to `to` (ISO dates). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / DAY)
}

export interface StripInput {
  status: string
  due: number
  /** Room charges not on the folio yet (nights post at the night audit and at check-out). */
  unposted?: number
  idOnFile: boolean
  depositPaid: number
  roomStatus: string
  checkIn: string
  checkOut: string
  today: string
  money: (n: number) => string
}

/** What sits in the strip under the guest's name: only the facts that need action or are asked for most. */
export function hubChips(i: StripInput): Chip[] {
  const out: Chip[] = []
  const live = i.status === "Confirmed" || i.status === "Checked In"
  const ended = i.status === "Checked Out" || i.status === "Cancelled" || i.status === "No Show"

  if (i.due > EPS) out.push({ key: "owed", tone: "bad", label: "To collect {amount}", vars: { amount: i.money(i.due) } })
  else if (i.status === "Checked In" && (i.unposted ?? 0) > EPS)
    out.push({ key: "owed", tone: "warn", label: "Not billed yet: {amount} posts at check-out", vars: { amount: i.money(i.unposted ?? 0) } })
  else if (i.status === "Checked In" || i.status === "Checked Out") out.push({ key: "owed", tone: "ok", label: "Bill settled" })

  if (!ended) out.push(i.idOnFile ? { key: "id", tone: "ok", label: "ID on file" } : { key: "id", tone: "warn", label: "No ID yet" })

  if (i.depositPaid > EPS && !ended)
    out.push({ key: "deposit", tone: "plain", label: "Deposit {amount} received", vars: { amount: i.money(i.depositPaid) } })

  if (live && i.roomStatus) {
    const bad = i.roomStatus === "Out of Order"
    const warn = i.roomStatus === "Dirty"
    out.push({ key: "room", tone: bad ? "bad" : warn ? "warn" : "plain", label: "Room {status}", vars: { status: i.roomStatus.toLowerCase() } })
  }

  if (i.status === "Checked In") {
    const left = daysBetween(i.today, i.checkOut)
    if (left < 0) out.push({ key: "when", tone: "bad", label: "Past the check-out date" })
    else if (left === 0) out.push({ key: "when", tone: "warn", label: "Leaves today" })
    else out.push({ key: "when", tone: "plain", label: left === 1 ? "Leaves in {n} day" : "Leaves in {n} days", vars: { n: left } })
  } else if (i.status === "Confirmed") {
    const to = daysBetween(i.today, i.checkIn)
    if (to < 0) out.push({ key: "when", tone: "bad", label: "Arrival missed" })
    else if (to === 0) out.push({ key: "when", tone: "warn", label: "Arrives today" })
    else out.push({ key: "when", tone: "plain", label: to === 1 ? "Arrives in {n} day" : "Arrives in {n} days", vars: { n: to } })
  }
  return out
}

/** "11 Nov 14:20", from the stamp the server sends ("2026-11-11 14:20:05"). */
export function stamp(s: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(s ?? "")
  if (!m) return s ?? ""
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} ${m[4]}`
}

export interface MoneyFolio {
  folio: string
  side: string
  status: string
  total: number
  paid: number
  balance: number
}

const SIDE: Record<string, string> = { Guest: "Guest bill", Company: "Company bill", Extra: "Extra bill", Group: "Group bill" }

/** The heading of one bill in the Money tab. */
export function folioTitle(f: Pick<MoneyFolio, "side" | "folio">): string {
  return `${SIDE[f.side] ?? f.side ?? "Bill"} · ${f.folio}`
}

/** The names of everyone staying, for the Guest and ID tab; the booker is not repeated. */
export function occupantLine(o: { full_name: string; arrived_at: string | null; left_at: string | null }): string {
  const bits = [o.full_name]
  if (o.arrived_at) bits.push(`arrived ${stamp(o.arrived_at)}`)
  if (o.left_at) bits.push(`left ${stamp(o.left_at)}`)
  return bits.join(" · ")
}

/** The guest's bill can stand higher at check-out than what is posted now, because the nights not yet
    posted are added then. This is that difference, so the panel can say why two totals differ. */
export function unpostedAmount(strip: number, folios: Pick<MoneyFolio, "side" | "balance">[]): number {
  const posted = folios.filter((f) => f.side === "Guest").reduce((s, f) => s + (Number(f.balance) || 0), 0)
  const diff = Math.round((strip - posted) * 100) / 100
  return diff > 0.005 ? diff : 0
}
