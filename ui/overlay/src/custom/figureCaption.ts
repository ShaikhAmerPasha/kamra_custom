/*  One line under a headline figure saying what it counts and for which days (Kamra Custom), so
    the same number on two screens is never mistaken for two different numbers. */

import { showDate } from "./showDate"

export type OwnerPeriod = "today" | "yesterday" | "month"

/** "Total revenue for 20 Nov 2026: rooms, food and other." or "...from 1 Nov 2026 to 20 Nov 2026". */
export function revenueCaption(period: OwnerPeriod, date: string | null | undefined): string {
  if (!date) return ""
  if (period === "month") {
    const first = `${String(date).slice(0, 8)}01`
    return `Total revenue from ${showDate(first)} to ${showDate(date)}: rooms, food and other.`
  }
  return `Total revenue for ${showDate(date)}: rooms, food and other.`
}
