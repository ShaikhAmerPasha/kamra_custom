/*  Mounted once in the app shell (Kamra Custom): applies MyCloud's screen names. Nobody is asked and there is nothing to choose. */

import { useEffect, useRef } from "react"
import { useAuth } from "../lib/auth"
import { useBackground } from "./backgroundStore"
import { wordsFor, type PmsId } from "./pmsBackground"
import { setVocabulary } from "./vocabulary"

export function BackgroundHost() {
  const { user } = useAuth()
  const id = useBackground(user)

  // the words follow the answer. The first paint already used the last answer; a change reloads the page once,
  // so every label on screen is drawn again with the new words.
  const seen = useRef<PmsId | undefined>(undefined)
  useEffect(() => {
    setVocabulary(wordsFor(id))
    if (seen.current !== undefined && seen.current !== id) window.location.reload()
    seen.current = id
  }, [id])

  return null
}
