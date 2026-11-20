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

/** The saved choice, or "guided". Storage that is missing or throws leaves the default. */
export function readView(store: Store | null | undefined, user: string | null | undefined): FormView {
  try {
    return store?.getItem(key(user)) === "full" ? "full" : "guided"
  } catch {
    return "guided"
  }
}

export function writeView(store: Store | null | undefined, user: string | null | undefined, view: FormView): void {
  try {
    store?.setItem(key(user), view)
  } catch {
    /* a private window may refuse storage: the choice then lasts until the panel closes */
  }
}
