/*  The facts a desk wants beside the check-in and check-out buttons (Kamra Custom): who the guest is,
    the stay, the rate, who pays, deposits, and notes. Pure: it reads what reservation_detail returns,
    and leaves out anything that is empty, so the list stays short. */

export interface DetailInput {
  name: string
  check_in_date: string
  check_out_date: string
  nights: number
  adults: number
  children: number
  room_number: string | null
  room_type_name: string | null
  meal_plan_name?: string | null
  meal_plan: string | null
  rate_plan: string | null
  source: string | null
  channel: string | null
  company: string | null
  travel_agent: string | null
  special_requests: string | null
  internal_remarks?: string | null
  night_rates?: { rate: number }[]
  guest: { full_name: string; vip: number; stays: number; last_stay: string | null } | null
  deposit?: { expected: number; paid: number; due: number } | null
  security_deposit?: { status: string; held: number; collected: number; required: number } | null
}

export type SectionKey = "guest" | "stay" | "money" | "notes"

export interface DetailRow {
  key: string
  section: SectionKey
  label: string
  value: string
  tone?: "warn" | "ok"
}

export interface Section {
  key: SectionKey
  label: string
  rows: DetailRow[]
  /** Something here needs the desk's eye: a deposit still due, or notes to read. */
  alert: boolean
}

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "guest", label: "Guest" },
  { key: "stay", label: "Stay and rate" },
  { key: "money", label: "Deposits" },
  { key: "notes", label: "Notes" },
]

/** Only the sections that have something to show, each with its rows. */
export function sections(rows: DetailRow[]): Section[] {
  return SECTIONS.map((s) => {
    const mine = rows.filter((r) => r.section === s.key)
    return { ...s, rows: mine, alert: s.key === "notes" ? mine.length > 0 : mine.some((r) => r.tone === "warn") }
  }).filter((s) => s.rows.length > 0)
}

type Fmt = { money: (n: number) => string; day: (iso: string | null | undefined) => string }

/** Average room rate per night from the rates fixed at booking; 0 when none are held. */
export function averageRate(rates: { rate: number }[] | undefined): number {
  if (!rates || !rates.length) return 0
  return rates.reduce((n, r) => n + (Number(r.rate) || 0), 0) / rates.length
}

export function detailRows(d: DetailInput, f: Fmt): DetailRow[] {
  const rows: DetailRow[] = []
  const add = (key: string, section: SectionKey, label: string, value: string | null | undefined, tone?: DetailRow["tone"]) => {
    const v = (value ?? "").toString().trim()
    if (v) rows.push({ key, section, label, value: v, tone })
  }
  if (d.guest) {
    const history = d.guest.stays > 0 ? `${d.guest.stays} earlier stay${d.guest.stays === 1 ? "" : "s"}${d.guest.last_stay ? `, last ${f.day(d.guest.last_stay)}` : ""}` : "First stay"
    add("guest", "guest", "Guest", [d.guest.full_name, d.guest.vip ? "VIP" : "", history].filter(Boolean).join(" · "))
  }
  const guests = `${d.adults} adult${d.adults === 1 ? "" : "s"}${d.children ? ` + ${d.children} child${d.children === 1 ? "" : "ren"}` : ""}`
  add("stay", "stay", "Stay", `${f.day(d.check_in_date)} → ${f.day(d.check_out_date)} · ${d.nights} night${d.nights === 1 ? "" : "s"} · ${guests}`)
  add("room", "stay", "Room", [d.room_number, d.room_type_name].filter(Boolean).join(" · "))
  const avg = averageRate(d.night_rates)
  add("rate", "stay", "Rate", [d.meal_plan_name || d.meal_plan, d.rate_plan, avg > 0 ? `${f.money(avg)} a night` : ""].filter(Boolean).join(" · "))
  add("booked", "stay", "Booked", [d.source === "OTA" ? d.channel || "OTA" : d.source, d.company ? `company ${d.company}` : "", d.travel_agent ? `agent ${d.travel_agent}` : ""].filter(Boolean).join(" · "))
  if (d.deposit && d.deposit.expected > 0)
    add("deposit", "money", "Deposit", `required ${f.money(d.deposit.expected)} · received ${f.money(d.deposit.paid)}${d.deposit.due > 0 ? ` · still due ${f.money(d.deposit.due)}` : ""}`, d.deposit.due > 0 ? "warn" : "ok")
  const sd = d.security_deposit
  if (sd && sd.status !== "None" && sd.status !== "Waived" && (sd.required > 0 || sd.held > 0 || sd.collected > 0))
    add("security", "money", "Security deposit", `${sd.status}${sd.held > 0 ? ` · held ${f.money(sd.held)}` : sd.required > 0 ? ` · required ${f.money(sd.required)}` : ""}`)
  add("requests", "notes", "Guest requests", d.special_requests)
  add("notes", "notes", "Staff notes", d.internal_remarks)
  return rows
}


export interface DenseBlock {
  title: string
  rows: { key: string; label: string; value: string; tone?: "warn" | "ok" }[]
}

/** The same facts as detailRows, one field to a row, grouped as the bars of a one-page form
    (Stay, Rate, Booking, Deposits, Notes). Empty rows and empty bars are left out. */
export function denseSections(d: DetailInput, f: Fmt): DenseBlock[] {
  const blocks: DenseBlock[] = []
  const bar = (title: string, rows: [string, string, string | number | null | undefined, ("warn" | "ok")?][]) => {
    const mine = rows
      .map(([key, label, value, tone]) => ({ key, label, value: (value ?? "").toString().trim(), tone }))
      .filter((r) => r.value !== "")
    if (mine.length) blocks.push({ title, rows: mine })
  }
  const guests = `${d.adults} adult${d.adults === 1 ? "" : "s"}${d.children ? ` + ${d.children} child${d.children === 1 ? "" : "ren"}` : ""}`
  bar("Stay", [
    ["arrive", "Arrival", f.day(d.check_in_date)],
    ["leave", "Departure", f.day(d.check_out_date)],
    ["nights", "Nights", d.nights],
    ["guests", "Guests", guests],
    ["rtype", "Room type", d.room_type_name],
    ["room", "Room", d.room_number],
  ])
  const avg = averageRate(d.night_rates)
  bar("Rate", [
    ["meal", "Meal plan", d.meal_plan_name || d.meal_plan],
    ["plan", "Rate plan", d.rate_plan],
    ["avg", "Rate a night", avg > 0 ? f.money(avg) : ""],
  ])
  const history = d.guest
    ? d.guest.stays > 0
      ? `${d.guest.stays} earlier stay${d.guest.stays === 1 ? "" : "s"}${d.guest.last_stay ? `, last ${f.day(d.guest.last_stay)}` : ""}`
      : "First stay"
    : ""
  bar("Booking", [
    ["source", "Booked thru", d.source === "OTA" ? d.channel || "OTA" : d.source],
    ["company", "Company", d.company],
    ["agent", "Travel agent", d.travel_agent],
    ["history", "History", [d.guest?.vip ? "VIP" : "", history].filter(Boolean).join(" · ")],
  ])
  const dep = d.deposit
  const sd = d.security_deposit
  bar("Deposits", [
    ["dep-req", "Required", dep && dep.expected > 0 ? f.money(dep.expected) : ""],
    ["dep-got", "Received", dep && (dep.expected > 0 || dep.paid > 0) ? f.money(dep.paid) : ""],
    ["dep-due", "To collect", dep && dep.due > 0 ? f.money(dep.due) : "", "warn"],
    [
      "security",
      "Security deposit",
      sd && sd.status !== "None" && sd.status !== "Waived" && (sd.required > 0 || sd.held > 0 || sd.collected > 0)
        ? `${sd.status}${sd.held > 0 ? ` · held ${f.money(sd.held)}` : sd.required > 0 ? ` · required ${f.money(sd.required)}` : ""}`
        : "",
    ],
  ])
  bar("Notes", [
    ["requests", "Guest requests", d.special_requests],
    ["staff", "Staff notes", d.internal_remarks],
  ])
  return blocks
}

export type BannerTone = "blue" | "green" | "grey" | "red" | "amber"

/** The status banner at the top of a stay panel: one word, in capitals, with a colour. */
export function statusBanner(status: string | null | undefined): { label: string; tone: BannerTone } {
  switch (status) {
    case "Confirmed":
      return { label: "CONFIRMED", tone: "blue" }
    case "Checked In":
      return { label: "IN HOUSE", tone: "green" }
    case "Checked Out":
      return { label: "CHECKED OUT", tone: "grey" }
    case "Cancelled":
      return { label: "CANCELLED", tone: "red" }
    case "No Show":
      return { label: "NO SHOW", tone: "red" }
    case "Waitlist":
    case "Waitlisted":
      return { label: "WAITLISTED", tone: "amber" }
    default:
      return { label: String(status || "BOOKING").toUpperCase(), tone: "grey" }
  }
}
