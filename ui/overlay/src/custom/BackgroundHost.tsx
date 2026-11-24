/*  Mounted once in the app shell (Kamra Custom): applies the previous system's words (MyCloud unless the person chose
    another one from the account menu). Nobody is asked at sign-in. */

import { useEffect, useRef } from "react"
import { useAuth } from "../lib/auth"
import { useT } from "../lib/i18n"
import { useBackground } from "./backgroundStore"
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
