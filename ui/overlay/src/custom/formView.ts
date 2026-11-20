/*  Guided or full form (Kamra Custom): which way a person likes the check-in and check-out panels. The choice
    is kept per user in the browser. Pure, with the storage passed in, so it can be tested. */

export type FormView = "guided" | "full"

export const FORM_VIEWS: { key: FormView; label: string }[] = [
  { key: "guided", label: "Guided" },
  { key: "full", label: "Full form" },
]

const key = (user: string | null | undefined) => `kamra:form-view:${user || "anonymous"}`

interface Store {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/** The saved choice, or the fallback (guided unless the person's previous system suggests otherwise). Storage that is missing or throws leaves the default. */
export function readView(store: Store | null | undefined, user: string | null | undefined, fallback: FormView = "guided"): FormView {
  try {
    const v = store?.getItem(key(user))
    return v === "full" || v === "guided" ? v : fallback
  } catch {
    return fallback
  }
}

export function writeView(store: Store | null | undefined, user: string | null | undefined, view: FormView): void {
  try {
    store?.setItem(key(user), view)
  } catch {
    /* a private window may refuse storage: the choice then lasts until the panel closes */
  }
}
