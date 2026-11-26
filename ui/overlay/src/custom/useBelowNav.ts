/*  Keep the menu bar visible above a full-page dialog (see belowNav.ts). */

import { useEffect, useState } from "react"
import { belowNavTop, SHORTCUT_STRIP } from "./belowNav"

export function useBelowNav() {
  const [top, setTop] = useState(0)
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector("[data-topnav]")
      setTop(belowNavTop(nav ? nav.getBoundingClientRect().bottom : null, window.innerHeight))
    }
    measure()
    window.addEventListener("resize", measure)
    const later = window.setTimeout(measure, 300)
    return () => {
      window.removeEventListener("resize", measure)
      window.clearTimeout(later)
    }
  }, [])
  // the strip of keyboard shortcuts at the foot of the window stays visible, so the dialog stops above it
  return { top, bottom: SHORTCUT_STRIP }
}
