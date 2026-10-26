/* The room line of the registration card. */

export interface GrcStay {
  status?: string | null
  room_number?: string | null
  room_type?: string | null
  room_type_name?: string | null
}

/** "101 · Deluxe Room" once the guest is in the house; the category alone before that. */
export function grcRoomLabel(r: GrcStay, t: (s: string) => string, on = true): string {
  const category = r.room_type_name ?? r.room_type ?? ""
  if (!on) return r.room_number ? `${r.room_number} · ${category}` : t("Unassigned")
  const inHouse = r.status === "Checked In" || r.status === "Checked Out"
  if (inHouse && r.room_number) return `${r.room_number} · ${category}`
  return category || t("Unassigned")
}
