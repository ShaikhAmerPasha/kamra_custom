/*  The Stay hub (Kamra Custom): one panel with everything about a booking, opened from any screen.
    The strip never scrolls away: who, where, what is owed, what is wrong, and the next action.
    The tabs hold the rest, one click each, without leaving the screen you were on. */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { call } from "../lib/api"
import { useT } from "../lib/i18n"
import { cur } from "../lib/money"
import { cn } from "../lib/utils"
import { Sheet } from "../components/ui/sheet"
import { useStayInfo } from "./StayChecklist"
import { NightTable, type Facts } from "./StayFacts"
import { showDate } from "./showDate"
import { stayNext } from "./stayBar"
import { trailLine } from "./stayFacts"
import { folioTitle, hubChips, occupantLine, stamp, TABS, unpostedAmount, type ChipTone, type HubTab, type MoneyFolio } from "./stayHub"

const money = (n: number) => `${cur()}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TONE: Record<ChipTone, string> = {
  bad: "bg-rose-50 text-rose-800",
  warn: "bg-amber-50 text-amber-800",
  ok: "bg-emerald-50 text-emerald-800",
  plain: "bg-zinc-100 text-zinc-700",
}

interface MoneyData {
  folios: (MoneyFolio & {
    invoice: string
    tax: number
    charges: { date: string; at: string; by: string; description: string; amount: number; gst_rate: number; gst: number; total: number; void: boolean; reason: string }[]
    payments: { date: string; at: string; by: string; kind: string; mode: string; amount: number; reference: string }[]
  })[]
}

interface LogRow {
  name: string
  creation: string
  actor: string | null
  agent_name: string | null
  action_type: string
  rationale: string | null
  reference_name: string | null
}

function Card(props: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-zinc-200 bg-white px-4 py-3", props.wide && "sm:col-span-2")}>
      <h3 className="mb-1.5 text-sm font-semibold text-zinc-800">{props.title}</h3>
      {props.children}
    </section>
  )
}

function Row(props: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <dt className="shrink-0 text-zinc-500">{props.k}</dt>
      <dd className={cn("min-w-0 break-words text-right", props.tone)}>{props.v}</dd>
    </div>
  )
}

export function StayHub(props: {
  reservation: string
  tab: HubTab
  onClose: () => void
  onCheckIn: (reservation: string) => void
  onCheckOut: (reservation: string) => void
  /** opens Kamra's full reservation sheet, where the booking can be edited */
  onEdit: (reservation: string) => void
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const info = useStayInfo(props.reservation)
  const [tab, setTab] = useState<HubTab>(props.tab)
  const [facts, setFacts] = useState<Facts & { trail: Parameters<typeof trailLine>[0] } | null>(null)
  const [moneyData, setMoneyData] = useState<MoneyData | null>(null)
  const [log, setLog] = useState<LogRow[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => setTab(props.tab), [props.tab, props.reservation])

  useEffect(() => {
    let live = true
    setFacts(null)
    setMoneyData(null)
    setLog(null)
    call<Facts & { trail: Parameters<typeof trailLine>[0] }>("kamra_custom.stay_facts.stay_facts", { reservation: props.reservation })
      .then((f) => live && setFacts(f))
      .catch(() => live && setError(t("Some details could not be loaded.")))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reservation])

  // the Money and History tabs load when first opened
  useEffect(() => {
    let live = true
    if (tab === "money" && !moneyData)
      call<MoneyData>("kamra_custom.stay_facts.stay_money", { reservation: props.reservation })
        .then((m) => live && setMoneyData(m))
        .catch(() => live && setError(t("The bills could not be loaded.")))
    if (tab === "history" && !log)
      call<LogRow[]>("kamra.agents_api.activity_feed", { record: props.reservation, limit: 60 })
        .then((r) => live && setLog(r))
        .catch(() => live && setLog([]))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, props.reservation])

  const d = info?.detail as (NonNullable<typeof info>["detail"] & {
    status?: string
    folio_name?: string | null
    money?: { total: number; paid: number; due: number }
    guest?: { full_name: string; phone: string | null; email: string | null; vip: number; stays: number; last_stay: string | null } | null
    occupants?: { full_name: string; arrived_at: string | null; left_at: string | null }[]
    actions?: { can_check_out?: boolean }
    eta?: string | null
    group?: { group_name: string; rooms: number } | null
    deposit?: { expected: number; paid: number; due: number } | null
    security_deposit?: { status: string; held: number } | null
  }) | undefined
  const today = new Date().toISOString().slice(0, 10)

  const close = props.onClose
  const go = (path: string) => {
    close()
    navigate(path)
  }

  if (!d) {
    return (
      <Sheet wide title={t("Stay")} onClose={close}>
        <p className="py-10 text-center text-sm text-zinc-500">{error || t("Loading…")}</p>
      </Sheet>
    )
  }

  const status = d.status ?? ""
  const chips = hubChips({
    status,
    due: d.money?.due ?? 0,
    unposted: facts?.unposted ?? 0,
    idOnFile: facts ? !!facts.id_on_file : !info?.idMissing,
    depositPaid: d.deposit?.paid ?? 0,
    roomStatus: facts?.room_status ?? "",
    checkIn: d.check_in_date,
    checkOut: d.check_out_date,
    today,
    money,
  })
  const next = stayNext({ status, checkIn: d.check_in_date, today, canCheckOut: !!d.actions?.can_check_out })
  const name = d.guest?.full_name ?? "Guest"
  const btn = "inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"

  return (
    <Sheet wide title={name} description={`${t(status)} · ${d.name}`} onClose={close}>
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 space-y-3 border-b border-zinc-200 bg-white px-1 pb-3">
          <p className="text-sm text-zinc-600">
            {d.room_number ? `${t("Room")} ${d.room_number}` : t("No room yet")}
            {d.room_type_name ? ` · ${d.room_type_name}` : ""} · {showDate(d.check_in_date)} → {showDate(d.check_out_date)} ·{" "}
            {d.nights} {d.nights === 1 ? t("night") : t("nights")}
          </p>
          <ul className="flex flex-wrap gap-2" aria-label={t("What needs a look")}>
            {chips.map((c) => (
              <li key={c.key} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE[c.tone])}>
                {t(c.label, c.vars)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {next === "checkin" && (
              <button type="button" className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700" onClick={() => props.onCheckIn(d.name)}>
                {t("Check in")}
              </button>
            )}
            {next === "checkout" && (
              <button type="button" className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700" onClick={() => props.onCheckOut(d.name)}>
                {t("Check out")}
              </button>
            )}
            {d.folio_name && (
              <button type="button" className={btn} onClick={() => go(`/billing/${encodeURIComponent(d.folio_name as string)}`)}>
                {t("Take payment")}
              </button>
            )}
            <button type="button" className={btn} onClick={() => go(`/grc/${encodeURIComponent(d.name)}`)}>
              {t("Registration card")}
            </button>
            <button type="button" className={btn} onClick={() => props.onEdit(d.name)}>
              {t("Edit details")}
            </button>
            <button type="button" className={btn} onClick={() => go(`/grc/${encodeURIComponent(d.name)}`)}>
              {t("Change room")}
            </button>
          </div>
          <div role="tablist" aria-label={t("Stay sections")} className="-mb-px flex flex-wrap gap-1 text-sm">
            {TABS.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={cn(
                  "border-b-2 px-3 py-2 font-medium",
                  tab === x.key ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800",
                )}
              >
                {t(x.label)}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {tab === "overview" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title={t("Stay")}>
              <dl>
                <Row k={t("Arrives")} v={`${showDate(d.check_in_date)}${d.eta ? `, ${String(d.eta).slice(0, 5)}` : ""}`} />
                <Row k={t("Leaves")} v={showDate(d.check_out_date)} />
                <Row k={t("Guests")} v={`${d.adults} ${d.adults === 1 ? t("adult") : t("adults")}${d.children ? ` + ${d.children} ${t("children")}` : ""}`} />
                {(d.meal_plan_name || d.meal_plan) && <Row k={t("Meal plan")} v={d.meal_plan_name || d.meal_plan} />}
                {facts && facts.nightly.length > 0 && (
                  <Row
                    k={t("Rate")}
                    v={`${money(facts.total / Math.max(1, d.nights))} ${t("a night, tax included")}${facts.agreed ? ` · ${t("agreed")}` : ""}`}
                  />
                )}
                {d.group && <Row k={t("Group")} v={`${d.group.group_name} (${d.group.rooms} ${t("rooms")})`} />}
              </dl>
            </Card>
            <Card title={t("Money")}>
              <dl>
                <Row k={t("Total")} v={money(d.money?.total ?? 0)} />
                <Row k={t("Paid")} v={money(d.money?.paid ?? 0)} />
                <Row k={t("To collect")} v={money(d.money?.due ?? 0)} tone={(d.money?.due ?? 0) > 0.005 ? "font-semibold text-rose-700" : ""} />
                {(facts?.unposted ?? 0) > 0.005 && <Row k={t("Not billed yet")} v={money(facts?.unposted ?? 0)} tone="font-semibold text-amber-700" />}
                {(d.deposit?.expected ?? 0) > 0 && <Row k={t("Deposit")} v={`${money(d.deposit?.paid ?? 0)} / ${money(d.deposit?.expected ?? 0)}`} />}
              </dl>
              <button type="button" className="mt-1 text-sm text-brand-700 underline" onClick={() => setTab("money")}>{t("See every charge and payment")}</button>
            </Card>
            <Card title={t("Guest")}>
              <dl>
                {d.guest?.phone && <Row k={t("Phone")} v={d.guest.phone} />}
                {d.guest?.email && <Row k={t("Email")} v={d.guest.email} />}
                {d.company && <Row k={t("Company")} v={d.company} />}
                {d.travel_agent && <Row k={t("Travel agent")} v={d.travel_agent} />}
                {(d.channel || d.source) && <Row k={t("Booked through")} v={d.channel || d.source} />}
                {!!d.guest?.stays && <Row k={t("Stays so far")} v={d.guest.stays} />}
              </dl>
            </Card>
            <Card title={t("Room")}>
              <dl>
                <Row k={t("Room")} v={d.room_number ? `${d.room_number}${d.room_type_name ? ` · ${d.room_type_name}` : ""}` : t("Not assigned")} />
                {facts?.room_status && <Row k={t("Housekeeping")} v={facts.room_status} />}
                {d.security_deposit && d.security_deposit.held > 0 && <Row k={t("Security deposit held")} v={money(d.security_deposit.held)} />}
              </dl>
            </Card>
            {(d.special_requests || d.internal_remarks) && (
              <Card title={t("Notes")} wide>
                {d.special_requests && <p className="whitespace-pre-line text-sm text-zinc-700">{d.special_requests}</p>}
                {d.internal_remarks && <p className="mt-1 whitespace-pre-line text-sm text-zinc-500">{t("Staff note")}: {d.internal_remarks}</p>}
              </Card>
            )}
            {facts && trailLine(facts.trail) && <p className="text-xs text-zinc-500 sm:col-span-2">{trailLine(facts.trail)}</p>}
          </div>
        )}

        {tab === "rates" &&
          (facts ? (
            facts.nightly.length ? (
              <div className="space-y-2">
                <NightTable facts={facts} />
                {facts.agreed && <p className="text-xs text-zinc-500">{t("This is the agreed rate")}{facts.agreed_by ? ` (${facts.agreed_by})` : ""}.</p>}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{t("No night-by-night price is stored for this booking.")}</p>
            )
          ) : (
            <p className="text-sm text-zinc-500">{t("Loading…")}</p>
          ))}

        {tab === "money" &&
          (!moneyData ? (
            <p className="text-sm text-zinc-500">{t("Loading…")}</p>
          ) : moneyData.folios.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("No bill is open for this booking yet.")}</p>
          ) : (
            <div className="space-y-4">
              {moneyData.folios.map((f) => (
                <section key={f.folio} className="rounded-xl border border-zinc-200 bg-white">
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
                    <h3 className="text-sm font-semibold">{folioTitle(f)} <span className="font-normal text-zinc-500">· {t(f.status)}{f.invoice ? ` · ${f.invoice}` : ""}</span></h3>
                    <span className={cn("text-sm font-semibold", f.balance > 0.005 ? "text-rose-700" : "text-emerald-700")}>
                      {f.balance > 0.005 ? `${t("To collect")} ${money(f.balance)}` : t("Settled")}
                    </span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-zinc-500">
                          <th className="px-3 py-1.5 text-left font-medium">{t("Posted")}</th>
                          <th className="px-3 py-1.5 text-left font-medium">{t("What")}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{t("Tax")}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{t("Amount")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {f.charges.map((c, i) => (
                          <tr key={`c${i}`} className={cn(c.void && "text-zinc-400 line-through")} title={c.by ? `${t("Posted by")} ${c.by}${c.reason ? ` · ${c.reason}` : ""}` : undefined}>
                            <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{stamp(c.at) || showDate(c.date)}</td>
                            <td className="px-3 py-1.5">{c.description}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{c.gst ? `${money(c.gst)} (${c.gst_rate}%)` : "-"}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{money(c.total)}</td>
                          </tr>
                        ))}
                        {f.payments.map((p, i) => (
                          <tr key={`p${i}`} className="bg-emerald-50/40" title={p.by ? `${t("Taken by")} ${p.by}` : undefined}>
                            <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{stamp(p.at) || showDate(p.date)}</td>
                            <td className="px-3 py-1.5">{p.kind === "Refund" ? t("Refund") : t("Payment")} · {p.mode}{p.reference ? ` · ${p.reference}` : ""}{p.by ? ` · ${p.by}` : ""}</td>
                            <td className="px-3 py-1.5 text-right">-</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-emerald-800">-{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-zinc-200 font-semibold">
                          <td className="px-3 py-1.5" colSpan={3}>{t("Total")} · {t("Paid")} {money(f.paid)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{money(f.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              ))}
              {unpostedAmount(d.money?.due ?? 0, moneyData.folios) > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {t("Nights not posted to the bill yet: {amount}. They are added at check-out, so the amount to collect then is {due}.", {
                    amount: money(unpostedAmount(d.money?.due ?? 0, moneyData.folios)),
                    due: money(d.money?.due ?? 0),
                  })}
                </p>
              )}
              {d.folio_name && (
                <button type="button" className="text-sm text-brand-700 underline" onClick={() => go(`/billing/${encodeURIComponent(d.folio_name as string)}`)}>
                  {t("Open the bill to discount, split or print")}
                </button>
              )}
            </div>
          ))}

        {tab === "guest" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title={t("Identity")}>
              <dl>
                <Row k={t("Name")} v={name} />
                <Row k={t("ID")} v={facts ? (facts.id_on_file ? t("On file") : t("Not yet")) : "…"} tone={facts && !facts.id_on_file ? "font-medium text-amber-700" : ""} />
                {d.guest?.phone && <Row k={t("Phone")} v={d.guest.phone} />}
                {d.guest?.email && <Row k={t("Email")} v={d.guest.email} />}
                {d.guest?.last_stay && <Row k={t("Last stay before this")} v={showDate(d.guest.last_stay)} />}
              </dl>
              {facts && !facts.id_on_file && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-zinc-500">{t("No ID number or scan is saved for this guest.")}</p>
                  <button type="button" className={btn} onClick={() => props.onEdit(d.name)}>
                    {t("Add the ID")}
                  </button>
                </div>
              )}
            </Card>
            <Card title={t("Everyone on this stay")}>
              {d.occupants && d.occupants.length ? (
                <ul className="space-y-1 text-sm">
                  {d.occupants.map((o, i) => <li key={i}>{occupantLine(o)}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">{d.adults} {d.adults === 1 ? t("adult") : t("adults")}{d.children ? ` + ${d.children} ${t("children")}` : ""}. {t("Names are taken at check-in.")}</p>
              )}
            </Card>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-3">
            <Card title={t("Guest requests")}>
              <p className="whitespace-pre-line text-sm text-zinc-700">{d.special_requests || t("None.")}</p>
            </Card>
            <Card title={t("Staff notes")}>
              <p className="whitespace-pre-line text-sm text-zinc-700">{d.internal_remarks || t("None.")}</p>
            </Card>
          </div>
        )}

        {tab === "history" &&
          (log === null ? (
            <p className="text-sm text-zinc-500">{t("Loading…")}</p>
          ) : log.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("Nothing has been logged for this booking.")}</p>
          ) : (
            <div className="space-y-2">
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
                {log.map((r) => (
                  <li key={r.name} className="flex gap-3 px-4 py-2">
                    <span className="w-28 shrink-0 text-xs text-zinc-500">{stamp(r.creation)}</span>
                    <span className="w-28 shrink-0 truncate font-medium">{r.agent_name || (r.actor ?? "system").split("@")[0]}</span>
                    <span className="min-w-0">
                      <span className="font-medium capitalize">{r.action_type.replace(/_/g, " ")}</span>
                      {r.rationale ? <span className="text-zinc-500"> · {r.rationale}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" className="text-sm text-brand-700 underline" onClick={() => go(`/activity?record=${encodeURIComponent(d.name)}`)}>
                {t("Open the full log to search or download")}
              </button>
            </div>
          ))}
      </div>
    </Sheet>
  )
}
