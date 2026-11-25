/*  Registration cards of several bookings, printed together (Kamra Custom). Kamra's own card is shown
    once per booking, with a page break between them, and one Print button prints them all. */

import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import RegistrationCard from "../screens/RegistrationCard"
import { useT } from "../lib/i18n"
import { idsFromQuery } from "./bulk"

export default function RegistrationCards() {
  const { t } = useT()
  const ids = idsFromQuery(useLocation().search)
  const navigate = useNavigate()
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 print:hidden">
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => navigate(-1)}>{t("Back")}</button>
        <button type="button" className="rounded bg-brand-600 px-3 py-1 text-sm text-white" onClick={() => window.print()} disabled={!ids.length}>
          {t("Print {n} cards", { n: ids.length })}
        </button>
        {!ids.length ? <span className="text-sm text-zinc-600">{t("No bookings chosen.")}</span> : null}
      </div>
      {ids.map((id) => (
        <section key={id} className="break-after-page">
          {/* Kamra's card reads the booking from the address, so each one is shown at its own address */}
          <Routes location={{ pathname: `/reservation-search/cards/${id}` }}>
            <Route path=":name" element={<RegistrationCard />} />
          </Routes>
        </section>
      ))}
    </div>
  )
}
