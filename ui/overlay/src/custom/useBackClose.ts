/*  Let the browser's Back, or a trackpad swipe, close a pop-up (see backStack.ts). */

import { useEffect, useRef } from "react"
import { createBackStack } from "./backStack"

let stack: ReturnType<typeof createBackStack> | null = null
const shared = () => (stack ??= createBackStack(window, window.history))

export function useBackClose(onClose: () => void) {
  const latest = useRef(onClose)
  latest.current = onClose
  useEffect(() => shared().open(() => latest.current()), [])
}
