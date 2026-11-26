/*  Where a full-page dialog starts so the menu bar stays visible above it (Kamra Custom). */

/** The dialog's top edge: just under the menu bar, never above the window or lower than half of it. */
export function belowNavTop(navBottom: number | null | undefined, windowHeight: number): number {
  if (navBottom == null || !Number.isFinite(navBottom)) return 0
  return Math.min(Math.max(0, Math.round(navBottom)), Math.floor(windowHeight / 2))
}

/** The height of the strip of keyboard shortcuts at the foot of the window. */
export const SHORTCUT_STRIP = 34
