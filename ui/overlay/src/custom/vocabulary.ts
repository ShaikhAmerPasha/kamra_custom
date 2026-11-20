/*  The word list in force (Kamra Custom): Kamra's English label, replaced by the word the person's previous
    system used. Read by Kamra's translate function for English only. */

import { readLastBackground, wordsFor } from "./pmsBackground"

const first = (): Record<string, string> => {
  try {
    return wordsFor(readLastBackground(typeof window === "undefined" ? null : window.localStorage))
  } catch {
    return {}
  }
}

let words: Record<string, string> = first()

export function setVocabulary(next: Record<string, string>) {
  words = next
}

export function vocabularyWord(source: string): string | undefined {
  return Object.hasOwn(words, source) ? words[source] : undefined
}
