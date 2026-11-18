/*  The billing details of the company chosen on a booking (Kamra Custom): shown only once a company
    is picked, so a booking without one stays short. */

import { useT } from "../lib/i18n"

export interface CompanyInfo {
  company_name: string
  gstin?: string
  contact_name?: string
  contact_phone?: string
}

export function CompanyDetails(props: { company: CompanyInfo | undefined }) {
  const { t } = useT()
  const c = props.company
  if (!c) return null
  const rows: [string, string][] = [
    [t("Billed to"), c.company_name],
    [t("GST number"), c.gstin || ""],
    [t("Contact"), [c.contact_name, c.contact_phone].filter(Boolean).join(" · ")],
  ]
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm sm:grid-cols-[7rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-zinc-500">{k}</dt>
          <dd className={v ? "min-w-0 break-words" : "text-amber-700"}>{v || t("Not on file")}</dd>
        </div>
      ))}
    </dl>
  )
}
