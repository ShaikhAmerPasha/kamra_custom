/*  The previous system is fixed to MyCloud (Kamra Custom): there is nothing to choose or store.
    Kept as a hook so the screen code that follows it stays unchanged. */

import { readBackground, type PmsId } from "./pmsBackground"

export function useBackground(_user?: string | null): PmsId {
  return readBackground()
}
