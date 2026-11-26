/*  How tall a page may be so it never scrolls: the window less what is above it and the shortcut strip below. */

export function fillHeight(windowHeight: number, top: number, bottom: number): number {
  return Math.max(240, Math.floor(windowHeight - top - bottom))
}
