/*  The Guided / Full form switch (Kamra Custom), shown at the top of the check-in and check-out panels. */

import { useCallback, useState } from "react"
import { useAuth } from "../lib/auth"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { FORM_VIEWS, readView, writeView, type FormView } from "./formView"
import { readBackground, defaultViewFor } from "./pmsBackground"

const store = () => (typeof window === "undefined" ? null : window.localStorage)

/** The view this person chose, and a way to change it. One choice serves both panels. */
export function useFormView(): [FormView, (v: FormView) => void] {
  const { user } = useAuth()
  const [view, setView] = useState<FormView>(() => readView(store(), user, defaultViewFor(readBackground(store(), user))))
  const set = useCallback(
    (v: FormView) => {
      setView(v)
      writeView(store(), user, v)
    },
    [user],
  )
  return [view, set]
}

export function FormViewSwitch(props: { view: FormView; onChange: (v: FormView) => void }) {
  const { t } = useT()
  return (
    <div role="radiogroup" aria-label={t("How the form is laid out")} className="ms-auto inline-flex overflow-hidden rounded-lg border border-zinc-300 text-xs font-medium">
      {FORM_VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="radio"
          aria-checked={props.view === v.key}
          onClick={() => props.onChange(v.key)}
          className={cn("px-3 py-1.5", props.view === v.key ? "bg-brand-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50")}
        >
          {t(v.label)}
        </button>
      ))}
    </div>
  )
}
