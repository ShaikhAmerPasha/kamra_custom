/** "2h 10m", "45m", "1d 2h". A dash when the time is unknown. */
export function formatElapsed(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-"
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}
