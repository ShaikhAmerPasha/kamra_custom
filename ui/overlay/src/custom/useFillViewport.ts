/*  Make a page exactly as tall as the room left under it, so the page itself never scrolls (Kamra Custom).
    The bottom allowance is the strip of keyboard shortcuts Kamra keeps at the foot of the window. */

import { useEffect, useRef, useState } from "react"
import { fillHeight } from "./fillHeight"

export function useFillViewport<T extends HTMLElement>(bottom = 44) {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  useEffect(() => {
    const measure = () => {
      if (ref.current) setHeight(fillHeight(window.innerHeight, ref.current.getBoundingClientRect().top + window.scrollY, bottom))
    }
    measure()
    window.addEventListener("resize", measure)
    // the top bar can change height once fonts and the property name load
    const later = window.setTimeout(measure, 400)
    return () => {
      window.removeEventListener("resize", measure)
      window.clearTimeout(later)
    }
  }, [bottom])
  return { ref, style: height ? { height } : undefined }
}
