/* The meal is part of the room rate, never a separate charge on a screen (Kamra Custom).

   Kamra posts a Room line and a Meal Plan line for each night. The desk wants one line: the room
   with the meal inside it. These helpers fold the meal into the room line for the screens, with
   the amounts added, so every total stays the same: only how it is laid out changes. */

export interface MealFoldable {
  charge_type: string
  description?: string
  amount: number
  gst_amount: number
  total?: number
  gst_rate?: number
  posting_date?: string
}

export type Folded<T> = T & { merged?: boolean; mixedTax?: boolean }

/** "European Plan × 2 adult(s)" -> "European Plan". */
export const planName = (description = "") => description.replace(/\s*×.*$/, "").trim()

/**
 * Room and Meal Plan lines become one Room line each night. Pairs by posting date when the lines
 * have one, else by order. Any other line is left alone. A meal with no room line to join stays
 * folded into the first room line, so nothing is shown as a meal charge.
 */
export function foldMealIntoRoom<T extends MealFoldable>(rows: T[]): Folded<T>[] {
  const rooms = rows.filter((r) => r.charge_type === "Room")
  const meals = rows.filter((r) => r.charge_type === "Meal Plan")
  if (meals.length === 0) return rows as Folded<T>[]
  if (rooms.length === 0) return rows as Folded<T>[]

  const byDate = rooms.every((r) => r.posting_date) && meals.every((m) => m.posting_date)
  const pair = new Map<T, T[]>()
  meals.forEach((m, i) => {
    const room = byDate
      ? rooms.find((r) => r.posting_date === m.posting_date) ?? rooms[Math.min(i, rooms.length - 1)]
      : rooms[Math.min(i, rooms.length - 1)]
    pair.set(room, [...(pair.get(room) ?? []), m])
  })

  const out: Folded<T>[] = []
  for (const r of rows) {
    if (r.charge_type === "Meal Plan") continue
    const joined = pair.get(r)
    if (!joined) {
      out.push(r as Folded<T>)
      continue
    }
    const mealAmount = joined.reduce((s, m) => s + m.amount, 0)
    const mealTax = joined.reduce((s, m) => s + m.gst_amount, 0)
    const mealTotal = joined.reduce((s, m) => s + (m.total ?? m.amount + m.gst_amount), 0)
    const plan = planName(joined[0].description)
    out.push({
      ...r,
      description: plan ? `${r.description ?? ""} with ${plan}`.trim() : r.description,
      amount: r.amount + mealAmount,
      gst_amount: r.gst_amount + mealTax,
      ...(r.total !== undefined ? { total: r.total + mealTotal } : {}),
      merged: true,
      mixedTax: joined.some((m) => m.gst_rate !== undefined && r.gst_rate !== undefined && m.gst_rate !== r.gst_rate),
    })
  }
  return out
}

export interface Head {
  head: string
  lines: number
  amount: number
  tax: number
  total: number
}

/** The "Summary" of a folio by head: the Meal Plan head is added to the Room head. */
export function foldMealHead(heads: Head[]): Head[] {
  const meal = heads.find((h) => h.head === "Meal Plan")
  const room = heads.find((h) => h.head === "Room")
  if (!meal || !room) return heads
  return heads
    .filter((h) => h.head !== "Meal Plan")
    .map((h) =>
      h.head === "Room"
        ? { ...h, amount: h.amount + meal.amount, tax: h.tax + meal.tax, total: h.total + meal.total }
        : h,
    )
}
