/*  Where the "I used to use…" answer lives while the app runs (Kamra Custom): the browser's storage, plus an
    event so every part of the screen follows a change at once. */

import { useEffect, useState } from "react"
import { readBackground, writeBackground, type PmsId } from "./pmsBackground"

const EVENT = "kamra:pms-background"
const store = () => (typeof window === "undefined" ? null : window.localStorage)

/** Save the answer and tell the rest of the screen. */
export function chooseBackground(user: string | null | undefined, id: PmsId) {
  writeBackground(store(), user, id)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

/** This person's answer (null when not asked yet), kept current when it changes. */
export function useBackground(user: string | null | undefined): PmsId | null {
  const [id, setId] = useState<PmsId | null>(() => readBackground(store(), user))
  useEffect(() => {
    setId(readBackground(store(), user))
    const on = () => setId(readBackground(store(), user))
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [user])
  return id
}
