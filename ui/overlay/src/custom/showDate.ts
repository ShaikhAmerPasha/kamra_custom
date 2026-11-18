/*  One way to show a day everywhere (Kamra Custom): "18 Nov 2026", never "2026-11-18" in one
    screen and "18/11/2026" in the next. Takes the ISO date Kamra stores. */

export function showDate(iso: string | null | undefined, locale?: string | string[]): string {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  if (!m) return String(iso)
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString(locale ?? "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

/** "18 Nov 2026 → 20 Nov 2026" for a stay. */
export function showStay(from: string | null | undefined, to: string | null | undefined, locale?: string | string[]): string {
  return `${showDate(from, locale)} → ${showDate(to, locale)}`
}
