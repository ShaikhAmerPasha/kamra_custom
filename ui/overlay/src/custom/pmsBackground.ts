/*  "I used to use…" (Kamra Custom): a person who has worked on another PMS finds Kamra easier when it speaks
    that system's words, answers to its screen names, and opens in the layout they know. This file holds the
    data and the rules. Pure, so they can be tested.

    Only MyCloud has names so far, taken from its real screens. The others get the layout only, until their
    names are collected from their own documentation or a demo. */

import type { FormView } from "./formView"

export type PmsId = "mycloud" | "winhms" | "opera" | "other" | "none"

export interface PmsChoice {
  id: PmsId
  label: string
  /** the layout this person starts in, unless they have chosen one themselves */
  view: FormView
  /** true when Kamra knows this system's screen names */
  names: boolean
}

export const PMS_CHOICES: PmsChoice[] = [
  { id: "mycloud", label: "MyCloud", view: "full", names: true },
  { id: "winhms", label: "WinHMS", view: "full", names: false },
  { id: "opera", label: "Opera", view: "guided", names: false },
  { id: "other", label: "Another system", view: "guided", names: false },
  { id: "none", label: "None, I am new to hotel software", view: "guided", names: false },
]

const storageKey = (user: string | null | undefined) => `kamra:pms-background:${user || "anonymous"}`

interface Store {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/** The saved answer, or null when this person has not been asked yet. */
export function readBackground(store: Store | null | undefined, user: string | null | undefined): PmsId | null {
  try {
    const v = store?.getItem(storageKey(user))
    return PMS_CHOICES.some((c) => c.id === v) ? (v as PmsId) : null
  } catch {
    return null
  }
}

const LAST_KEY = "kamra:pms-background:last"

/** The most recent answer given in this browser, whoever gave it. Used for the first paint, before the
    signed-in user is known, so the screen does not flash Kamra's words and then change. */
export function readLastBackground(store: Store | null | undefined): PmsId | null {
  try {
    const v = store?.getItem(LAST_KEY)
    return PMS_CHOICES.some((c) => c.id === v) ? (v as PmsId) : null
  } catch {
    return null
  }
}

export function writeBackground(store: Store | null | undefined, user: string | null | undefined, id: PmsId): void {
  try {
    store?.setItem(storageKey(user), id)
    store?.setItem(LAST_KEY, id)
  } catch {
    /* storage refused: the answer lasts until the page is reloaded */
  }
}

/** The layout a person starts in, before they choose one. */
export function defaultViewFor(id: PmsId | null): FormView {
  return PMS_CHOICES.find((c) => c.id === id)?.view ?? "guided"
}

/** Kamra's English label, and the word the other system uses for the same thing. */
export const MYCLOUD_WORDS: Record<string, string> = {
  Billing: "Cashiering",
  "New booking": "Quick reservation",
  "Check out": "Process check-out",
  "Change room": "Room transfer",
  "House today": "Management statistics",
  "Activity Log": "User activity log",
  "Activity log": "User activity log",
  Receivables: "Debtor account",
  "Booked through": "Booked thru",
}

/** The word list for a choice; empty when Kamra does not know that system's words yet. */
export function wordsFor(id: PmsId | null): Record<string, string> {
  return id === "mycloud" ? MYCLOUD_WORDS : {}
}

export interface Entry {
  /** the screen's name in the other system */
  name: string
  /** where the same job is done in Kamra */
  to: string
  /** what is different, in one line */
  note: string
}

/** MyCloud screen names, from its menu, and where each job lives in Kamra. */
export const MYCLOUD_SCREENS: Entry[] = [
  { name: "Front desk", to: "/tape", note: "The room chart. Click a booking for its stay panel; click an empty cell to book." },
  { name: "Express services", to: "/reservations", note: "Find a booking by name, date, phone or room, with status filters." },
  { name: "Reservations", to: "/reservations", note: "Open a booking and edit it in one sheet." },
  { name: "Cashiering", to: "/billing", note: "Open a bill to post charges, take payments and print the invoice." },
  { name: "Non room accounts", to: "/receivables", note: "Company and other accounts that are not a room." },
  { name: "Debtor account", to: "/receivables", note: "What companies owe, with ageing." },
  { name: "Task management", to: "/tickets", note: "Guest requests and tasks." },
  { name: "Groups", to: "/groups", note: "Group bookings and rooming lists." },
  { name: "Housekeeping", to: "/housekeeping-board", note: "Room status by floor, with tasks." },
  { name: "Mark Discrepancy", to: "/housekeeping-board", note: "Compare the front desk and housekeeping view of a room." },
  { name: "Lost and found items", to: "/lost-found", note: "Items found or lost, with their claim status." },
  { name: "Reports", to: "/reports", note: "All reports in one place, with custom reports." },
  { name: "Report setup", to: "/reports/custom", note: "Build and save your own report." },
  { name: "Management statistics", to: "/house", note: "House today: occupancy, revenue, movement, collections, owed." },
  { name: "BI dashboard", to: "/dashboard", note: "Revenue dashboard: today, month, year against last year." },
  { name: "Budgets", to: "/revenue-reports", note: "Budget against actual, with variance." },
  { name: "Availability management", to: "/rate-calendar", note: "Rates and availability by day." },
  { name: "Rate manager", to: "/rate-calendar", note: "Rates by room type and day." },
  { name: "Rate management", to: "/rate-plans", note: "Rate plans." },
  { name: "Meal plan", to: "/meal-plans", note: "Meal plans and their prices." },
  { name: "Inventory management", to: "/inventory", note: "Stock and inventory." },
  { name: "Channel manager", to: "/channel-manager", note: "Online channels and their bookings." },
  { name: "Booked thru", to: "/travel-agents", note: "Travel agents and booking sources." },
  { name: "Foreign currency maintenance", to: "/cashier/fx", note: "Currency rates at the cashier." },
  { name: "History maintenance", to: "/guests", note: "Guest history: stays, nights and value." },
  { name: "Manual No-Show", to: "/in-house?tab=arrivals", note: "Missed arrivals appear in the Needs attention panel too." },
  { name: "GST invoices", to: "/folio-history", note: "Closed bills and their invoices." },
  { name: "Night audit", to: "/end-of-day", note: "The daily close, with its audit pack." },
  { name: "User activity log", to: "/activity", note: "Everything that happened, searchable by words, date and booking." },
  { name: "Parameter setup", to: "/settings", note: "Hotel settings." },
]

/** Words a person might type in search, for each Kamra screen: every MyCloud name that points there. */
export function aliasTerms(to: string | undefined): string {
  if (!to) return ""
  const path = to.split("?")[0]
  return MYCLOUD_SCREENS.filter((e) => e.to.split("?")[0] === path)
    .map((e) => e.name)
    .join(" ")
}
