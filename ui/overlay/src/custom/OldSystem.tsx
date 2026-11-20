/*  "Where is it in my old system?" (Kamra Custom): the person's previous system, and a table from its screen
    names to Kamra's. */

import { Link } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { useT } from "../lib/i18n"
import { BackgroundChoice } from "./BackgroundHost"
import { chooseBackground, useBackground } from "./backgroundStore"
import { MYCLOUD_SCREENS } from "./pmsBackground"

export default function OldSystem() {
  const { t } = useT()
  const { user } = useAuth()
  const id = useBackground(user)
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("Where is it in my old system?")}</h1>
        <p className="text-sm text-zinc-500">{t("Choose the system you used before. Kamra then uses its words and layout, and the table shows where each of its screens lives here.")}</p>
      </header>
      <section className="max-w-lg space-y-2">
        <h2 className="text-sm font-semibold">{t("The system I used before")}</h2>
        <BackgroundChoice value={id} onPick={(v) => chooseBackground(user, v)} name="pms-background-page" />
      </section>
      {id === "mycloud" ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("MyCloud screen, and where it is in Kamra")}</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2 font-medium">{t("In MyCloud")}</th>
                  <th className="px-4 py-2 font-medium">{t("In Kamra")}</th>
                  <th className="px-4 py-2 font-medium">{t("What to know")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {MYCLOUD_SCREENS.map((e) => (
                  <tr key={e.name}>
                    <td className="px-4 py-2 font-medium">{e.name}</td>
                    <td className="px-4 py-2">
                      <Link to={e.to} className="text-brand-700 underline">{t("Open")}</Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">{t("You can also type a MyCloud screen name in the search box (Ctrl+K) to open its Kamra screen.")}</p>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">{t("A table of screen names is available for MyCloud. Other systems will be added.")}</p>
      )}
    </div>
  )
}
