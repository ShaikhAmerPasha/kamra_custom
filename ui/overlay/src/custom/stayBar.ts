// What the reservation panel's top bar shows. Plain logic, no screen code.

export interface StayFacts {
  status: string
  room: string | null
  idMissing: boolean
  paid: number
  due: number
}

export interface Item {
  key: string
  label: string
  ok: boolean
}

/** Checklist for a stay that has not ended. Empty once it is over. */
export function stayChecklist(f: StayFacts): Item[] {
  if (!["Confirmed", "Checked In"].includes(f.status)) return []
  const items: Item[] = [
    { key: "room", label: f.room ? `Room ${f.room}` : "No room yet", ok: !!f.room },
    { key: "id", label: f.idMissing ? "ID missing" : "ID on file", ok: !f.idMissing },
    { key: "money", label: f.due > 0.5 ? "Balance due" : f.paid > 0 ? "Paid" : "Nothing owed", ok: f.due <= 0.5 },
  ]
  // a stay in house already has its room: only the ID and money matter
  return f.status === "Checked In" ? items.filter((i) => i.key !== "room") : items
}

/** The main action: check in on or after the arrival day, check out while in house. */
export function stayNext(f: { status: string; checkIn: string; today: string; canCheckOut: boolean }): "checkin" | "checkout" | "" {
  if (f.status === "Confirmed" && f.checkIn <= f.today) return "checkin"
  if (f.status === "Checked In" && f.canCheckOut) return "checkout"
  return ""
}
