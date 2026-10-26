/*  Front desk reports (Kamra Custom): expected arrivals and departures, in-house
    guests, the meal plan report and agreed rates by approver. One screen, one filter
    row, one table and an Excel download. The rows come from kamra_custom.desk_reports. */

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Download } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Button } from "../components/ui/button"
import { fmtMoney } from "../lib/money"
import { useT } from "../lib/i18n"
import { reportDownloadUrl, today, type DeskReport, type ReportCatalog } from "./deskReports"

const input = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

export default function DeskReports() {
  const { t } = useT()
  const nav = useNavigate()
  const { report: param } = useParams()
  const property = getCurrentProperty()
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null)
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [plan, setPlan] = useState("")
  const [approver, setApprover] = useState("")
  const [data, setData] = useState<DeskReport | null>(null)
  const [error, setError] = useState("")

  const key = param ?? "arrivals"
  const spec = catalog?.reports.find((r) => r.key === key)

  useEffect(() => {
    call<ReportCatalog>("kamra_custom.desk_reports.catalog", { property })
      .then(setCatalog)
      .catch(() => setError(t("Reports could not be loaded.")))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property])

  const filters = useMemo(
    () => ({ report: key, property, from_date: from, to_date: spec?.range ? to : from, plan: spec?.plan ? plan : "", approver: spec?.approver ? approver : "" }),
    [key, property, from, to, plan, approver, spec],
  )

  useEffect(() => {
    if (!spec || !from || (spec.range && !to)) return
    let live = true
    setError("")
    call<DeskReport>("kamra_custom.desk_reports.run", filters)
      .then((d) => live && setData(d))
      .catch((e) => {
        if (!live) return
        setData(null)
        try {
          const msgs = JSON.parse(JSON.parse((e as { body?: string }).body ?? "")._server_messages ?? "[]")
          setError(msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || t("That did not work."))
        } catch {
          setError(t("That did not work."))
        }
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const cell = (type: string, v: unknown) => (v === null || v === undefined || v === "" ? "" : type === "money" ? fmtMoney(Number(v)) : String(v))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{t("Front desk reports")}</h1>
          <p className="text-xs text-zinc-500">
            <Link to="/reports" className="underline">{t("All reports")}</Link>
          </p>
        </div>
        <a
          className={`inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:border-brand-400 ${data ? "" : "pointer-events-none opacity-50"}`}
          href={reportDownloadUrl(filters)}
        >
          <Download className="size-4" aria-hidden />
          {t("Download Excel")}
        </a>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-zinc-200">
        {catalog?.reports.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === key}
            onClick={() => nav(`/desk-reports/${r.key}`)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${r.key === key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900"}`}
          >
            {r.title}
          </button>
        ))}
      </div>

      {spec ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={label} htmlFor="dr-from">{spec.range ? t("From") : t("Date")}</label>
            <input id="dr-from" type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          {spec.range ? (
            <div>
              <label className={label} htmlFor="dr-to">{t("To")}</label>
              <input id="dr-to" type="date" className={input} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          ) : null}
          {spec.plan ? (
            <div>
              <label className={label} htmlFor="dr-plan">{t("Plan")}</label>
              <select id="dr-plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="">{t("All plans")}</option>
                {catalog?.plans.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          ) : null}
          {spec.approver ? (
            <div>
              <label className={label} htmlFor="dr-approver">{t("Approved by")}</label>
              <select id="dr-approver" className={input} value={approver} onChange={(e) => setApprover(e.target.value)}>
                <option value="">{t("Everyone")}</option>
                {catalog?.approvers.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => { setFrom(today()); setTo(today()) }}>{t("Today")}</Button>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}

      {data ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600">
            <b>{data.title}</b> · {data.when} · {t("{n} rows", { n: data.rows.length })}
            {data.summary.map((s) => <span key={s} className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs">{s}</span>)}
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  {data.columns.map((c) => (
                    <th key={c.key} className={`px-3 py-2 ${c.type === "number" || c.type === "money" ? "text-right" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.rows.map((r, i) => (
                  <tr key={`${r.ref}-${i}`}>
                    {data.columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${c.type === "number" || c.type === "money" ? "text-right" : ""}`}>{cell(c.type, r[c.key])}</td>
                    ))}
                  </tr>
                ))}
                {data.rows.length === 0 ? (
                  <tr><td className="px-3 py-6 text-center text-zinc-500" colSpan={data.columns.length}>{t("Nothing for these dates.")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
