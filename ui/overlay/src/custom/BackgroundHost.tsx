/*  Mounted once in the app shell (Kamra Custom): applies the person's previous-system words, and asks the
    question once, at the first sign-in. */

import { useEffect, useRef, useState } from "react"
import { useAuth } from "../lib/auth"
import { useT } from "../lib/i18n"
import { useBackground, chooseBackground } from "./backgroundStore"
import { PMS_CHOICES, wordsFor, type PmsId } from "./pmsBackground"
import { setVocabulary } from "./vocabulary"

export function BackgroundChoice(props: { value: PmsId | null; onPick: (id: PmsId) => void; name?: string }) {
  const { t } = useT()
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{t("The system you used before")}</legend>
      {PMS_CHOICES.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm hover:bg-zinc-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
          <input type="radio" name={props.name ?? "pms-background"} className="mt-0.5" checked={props.value === c.id} onChange={() => props.onPick(c.id)} />
          <span>
            <span className="font-medium">{t(c.label)}</span>
            {c.id !== "none" && c.id !== "other" && (
              <span className="block text-xs text-zinc-500">
                {c.names ? t("Kamra will use its screen names and open the full form.") : c.view === "full" ? t("Kamra will open the full form. Its screen names are not added yet.") : t("Its screen names are not added yet.")}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function BackgroundHost() {
  const { t } = useT()
  const { user } = useAuth()
  const id = useBackground(user)
  const [pick, setPick] = useState<PmsId | null>(null)

  // the words follow the answer. The first paint already used the last answer; a change reloads the page once,
  // so every label on screen is drawn again with the new words.
  const seen = useRef<PmsId | null | undefined>(undefined)
  useEffect(() => {
    setVocabulary(wordsFor(id))
    if (seen.current !== undefined && seen.current !== id && id !== null) window.location.reload()
    seen.current = id
  }, [id])

  if (!user || id !== null) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t("Which system did you use before?")}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold">{t("Which system did you use before?")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("Kamra can use the words and layout you already know. You can change this any time from your account menu.")}</p>
        </div>
        <BackgroundChoice value={pick} onPick={setPick} />
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm" onClick={() => chooseBackground(user, "none")}>
            {t("Skip")}
          </button>
          <button type="button" disabled={!pick} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => pick && chooseBackground(user, pick)}>
            {t("Save")}
          </button>
        </div>
      </div>
    </div>
  )
}
