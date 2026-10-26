// The bill with the meal inside the room line: one line a night, "Room 201 · Deluxe with Continental Plan".

export interface BillCharge {
  name: string
  posting_date: string
  charge_type: string
  description: string
  amount: number
  gst_rate: number
  gst_amount: number
  total: number
}

export interface BillLine {
  key: string
  date: string
  item: string
  amount: number
  /** The tax rate of the line, or null when the room and meal are taxed at different rates. */
  gst_rate: number | null
  gst_amount: number
  total: number
}

/** "Continental Plan × 2 adult(s)" -> "Continental Plan". */
export const mealName = (description: string) => description.replace(/\s*×.*$/, "").trim()

/**
 * Each night's Room and Meal Plan charges become one line. Any other charge stays as it is.
 * The amounts add up exactly, so the bill total does not change: only how it is laid out.
 */
export function mergeMealIntoRoom(charges: BillCharge[]): BillLine[] {
  const meals = new Map<string, BillCharge>()
  for (const c of charges) if (c.charge_type === "Meal Plan") meals.set(c.posting_date, c)
  const used = new Set<string>()
  const lines: BillLine[] = []

  for (const c of charges) {
    if (c.charge_type === "Meal Plan") continue
    const meal = c.charge_type === "Room" && !used.has(c.posting_date) ? meals.get(c.posting_date) : undefined
    if (meal) {
      used.add(c.posting_date)
      lines.push({
        key: c.name,
        date: c.posting_date,
        item: `Room - ${c.description} with ${mealName(meal.description)}`,
        amount: c.amount + meal.amount,
        gst_rate: c.gst_rate === meal.gst_rate ? c.gst_rate : null,
        gst_amount: c.gst_amount + meal.gst_amount,
        total: c.total + meal.total,
      })
    } else {
      lines.push({
        key: c.name,
        date: c.posting_date,
        item: c.description ? `${c.charge_type} - ${c.description}` : c.charge_type,
        amount: c.amount,
        gst_rate: c.gst_rate,
        gst_amount: c.gst_amount,
        total: c.total,
      })
    }
  }
  // a meal with no room line that night stays on the bill as its own line
  for (const [date, meal] of meals) {
    if (!used.has(date)) {
      lines.push({
        key: meal.name, date, item: `Meal Plan - ${meal.description}`, amount: meal.amount,
        gst_rate: meal.gst_rate, gst_amount: meal.gst_amount, total: meal.total,
      })
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date))
}
