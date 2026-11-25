/*  Reservation search (Kamra Custom): MyCloud's way into every booking. Pick a status, narrow with
    the filters or a shortcut, read the grid, open a row. Opening uses Kamra's own booking panel, so
    nothing about a booking is re-implemented here. */

import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Crown, Repeat, Users, Layers } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Sheet } from "../components/ui/sheet"
import { useT } from "../lib/i18n"
import ReservationDetail from "../screens/ReservationDetail"
import {
  EMPTY_FILTERS, SEARCH_SHORTCUTS, SEARCH_SORTS, SEARCH_STATUSES, STATUS_SHORT,
  marks, nameIsShort, searchArgs, withShortcut, withStatus, type SearchFilters,
} from "./reservationSearch"
import {
  BULK_ACTIONS, cardsPath, headState, keepShown, summary, toggle, toggleAll,
  type BulkAction, type BulkAnswer,
} from "./bulk"
import "./desk.css"

interface Found {
  name: string
  guest: string
  guest_name: string
  phone: string | null
  nationality: string | null
  guest_class: string | null
  room: string | null
  room_number: string | null
  room_type: string | null
  status: string
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
  room_rate: number
  balance: number
  deposit: number
  ota_ref: string | null
  company: string | null
  source: string | null
  channel: string | null
  group_booking: string | null
  group_name: string | null
  is_leader: boolean
  repeater: boolean
  travels_with_others: boolean
}
interface Result { rows: Found[]; total: number; truncated: boolean }

const SEGMENTS = ["Corporate", "Leisure", "Group", "MICE", "Government"]
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: string) => d.split("-").reverse().join("/")

function Row(props: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className="kd-row">
      <span className="kd-lab">{props.label}</span>
      <span className="kd-ctl">{props.children}</span>
    </label>
  )
}

export default function ReservationSearch() {
  const { t } = useT()
  const property = getCurrentProperty()
  const [f, setF] = useState<SearchFilters>(EMPTY_FILTERS)
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Found | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [working, setWorking] = useState<BulkAction | null>(null)
  const [answer, setAnswer] = useState<{ action: BulkAction; data: BulkAnswer } | null>(null)
  const [bulkError, setBulkError] = useState("")
  const navigate = useNavigate()
  const [roomTypes, setRoomTypes] = useState<{ name: string; room_type_name: string }[]>([])

  const run = useCallback(
    (filters: SearchFilters) => {
      setBusy(true)
      call<Result>("kamra_custom.reservations.search", searchArgs(property, filters))
        .then((r) => (setRes(r), setTicked((t0) => keepShown(t0, r.rows.map((x) => x.name))), setFailed(false)))
        .catch(() => setFailed(true))
        .finally(() => setBusy(false))
    },
    [property],
  )

  useEffect(() => {
    run(EMPTY_FILTERS)
    call<{ name: string; room_type_name: string }[]>("frappe.client.get_list", {
      doctype: "Room Type", filters: { property }, fields: ["name", "room_type_name"], limit_page_length: 100,
    }).then(setRoomTypes).catch(() => setRoomTypes([]))
  }, [property, run])

  const shownNames = (res?.rows ?? []).map((r) => r.name)
  const head = headState(ticked, shownNames)

  function bulk(action: BulkAction) {
    setWorking(action)
    setBulkError("")
    setAnswer(null)
    call<BulkAnswer>("kamra_custom.bulk.run", { action, reservations: ticked })
      .then((data) => {
        setAnswer({ action, data })
        run(f)
      })
      .catch((e) => {
        let text = t("That did not work.")
        try {
          const body = JSON.parse((e as { body?: string }).body ?? "")
          const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
          text = msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || text
        } catch {
          /* not a Frappe error body */
        }
        setBulkError(text)
      })
      .finally(() => setWorking(null))
  }

  const set = (patch: Partial<SearchFilters>) => setF((p) => ({ ...p, ...patch }))
  const go = (next: SearchFilters) => {
    setF(next)
    run(next)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(f)
  }

  return (
    <div className="kd space-y-3 p-3">
      <h1 className="text-lg font-semibold">{t("Reservations")}</h1>
      <form onSubmit={submit} className="space-y-2">
        <div role="radiogroup" aria-label={t("Status")} className="flex flex-wrap gap-4">
          {SEARCH_STATUSES.map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-sm">
              <input type="radio" name="status" checked={f.status === key} onChange={() => go(withStatus(f, key))} />
              {t(label)}
            </label>
          ))}
        </div>
        <div className="grid gap-x-6 md:grid-cols-3">
          <div>
            <Row label={t("Name")}><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="w-full" autoFocus /></Row>
            <Row label={t("Date")}>
              <span className="flex gap-1">
                <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="w-full" />
                <select value={f.date_in} onChange={(e) => set({ date_in: e.target.value as "arrival" | "departure" })} aria-label={t("Search date in")}>
                  <option value="arrival">{t("Arrival date")}</option>
                  <option value="departure">{t("Departure date")}</option>
                </select>
              </span>
            </Row>
            <Row label={t("Phone / Mobile")}><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="w-full" /></Row>
            <Row label={t("Market segment")}>
              <select value={f.market_segment} onChange={(e) => set({ market_segment: e.target.value })} className="w-full">
                <option value="" />
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="">
              <span className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={f.include_accompanying} onChange={(e) => set({ include_accompanying: e.target.checked })} />
                {t("Include accompanying guests")}
              </span>
            </Row>
          </div>
          <div>
            <Row label={t("Reservation #")}><input value={f.reservation} onChange={(e) => set({ reservation: e.target.value })} className="w-full" /></Row>
            <Row label={t("Room number")}><input value={f.room} onChange={(e) => set({ room: e.target.value })} className="w-full" /></Row>
            <Row label={t("Room type")}>
              <select value={f.room_type} onChange={(e) => set({ room_type: e.target.value })} className="w-full">
                <option value="" />
                {roomTypes.map((r) => <option key={r.name} value={r.name}>{r.room_type_name || r.name}</option>)}
              </select>
            </Row>
            <Row label={t("Group name")}><input value={f.group_name} onChange={(e) => set({ group_name: e.target.value })} className="w-full" /></Row>
            <Row label={t("Sort by")}>
              <span className="flex gap-2">
                <select value={f.sort_by} onChange={(e) => set({ sort_by: e.target.value })} className="w-full">
                  {SEARCH_SORTS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
                </select>
                <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                  <input type="checkbox" checked={f.descending} onChange={(e) => set({ descending: e.target.checked })} />
                  {t("Descending")}
                </label>
              </span>
            </Row>
          </div>
          <div className="flex flex-col items-end gap-1">
            {SEARCH_SHORTCUTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={f.shortcut === key}
                onClick={() => go(withShortcut(f, f.shortcut === key ? "" : key))}
                className={`w-72 rounded border px-2 py-1 text-sm ${f.shortcut === key ? "bg-brand-600 text-white" : ""}`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-brand-600 px-4 py-1 text-sm text-white">{t("Search")}</button>
          <button type="button" className="rounded border px-4 py-1 text-sm" onClick={() => go(EMPTY_FILTERS)}>{t("Clear")}</button>
          {nameIsShort(f) ? <span className="self-center text-xs text-zinc-600">{t("Type at least 3 letters of the name for a faster search.")}</span> : null}
        </div>
      </form>

      {failed ? <p role="alert" className="text-sm text-rose-700">{t("The search did not work. Try again.")}</p> : null}
      <p className="flex items-center gap-4 text-xs text-zinc-600" aria-live="polite">
        <span>{busy ? t("Searching…") : t("{n} found", { n: res?.total ?? 0 })}</span>
        {res?.truncated ? <span>{t("Showing the first {n}. Narrow the search to see the rest.", { n: res.rows.length })}</span> : null}
        <span className="ms-auto flex items-center gap-3">
          <span className="flex items-center gap-1"><Crown className="size-3" aria-hidden />{t("Group leader")}</span>
          <span className="flex items-center gap-1"><Layers className="size-3" aria-hidden />{t("In a group")}</span>
          <span className="flex items-center gap-1"><Repeat className="size-3" aria-hidden />{t("Repeater")}</span>
          <span className="flex items-center gap-1"><Users className="size-3" aria-hidden />{t("Accompanying guests")}</span>
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="toolbar" aria-label={t("Actions on the ticked bookings")}>
        <span className="text-xs text-zinc-600" aria-live="polite">{ticked.length ? t("{n} ticked", { n: ticked.length }) : t("Tick bookings to act on them.")}</span>
        {BULK_ACTIONS.map(([key, label]) => (
          <button key={key} type="button" disabled={!ticked.length || working !== null} onClick={() => bulk(key)} className="rounded border px-3 py-1 disabled:opacity-50">
            {working === key ? t("Working…") : t(label)}
          </button>
        ))}
        <button type="button" disabled={!ticked.length || working !== null} onClick={() => navigate(cardsPath(ticked))} className="rounded border px-3 py-1 disabled:opacity-50">
          {t("Print registration cards")}
        </button>
      </div>
      {bulkError ? <p role="alert" className="text-sm text-rose-700">{bulkError}</p> : null}
      {answer ? (
        <div role="status" className="border p-2 text-sm">
          <p className="font-medium">{t(summary(answer.data, answer.action))}</p>
          <ul className="mt-1 space-y-0.5">
            {answer.data.results.map((r) => (
              <li key={r.reservation} className={r.ok ? "text-emerald-700" : "text-rose-700"}>
                {r.ok ? "✓" : "✗"} {r.guest_name || r.reservation} · {r.reservation}: {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-600 text-left text-white">
              <th className="px-2 py-1">
                <input type="checkbox" aria-label={t("Tick all")} checked={head === "all"} ref={(el) => { if (el) el.indeterminate = head === "some" }} onChange={() => setTicked(toggleAll(ticked, shownNames))} />
              </th>
              {["", "Guest name", "Arrival", "Departure", "Firm name", "Room type", "Booked thru", "Status", "Room rate", "Balance", "Deposit", "Other reference #", "Nationality", "Class", "Reservation #"].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h ? t(h) : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(res?.rows ?? []).map((r) => (
              <tr key={r.name} className="cursor-pointer border-t hover:bg-zinc-100" onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(r)}>
                <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={t("Tick {n}", { n: r.name })} checked={ticked.includes(r.name)} onChange={() => setTicked(toggle(ticked, r.name))} />
                </td>
                <td className="whitespace-nowrap px-2 py-1">
                  {marks(r).map((m) =>
                    m === "leader" ? <Crown key={m} className="inline size-3.5" aria-label={t("Group leader")} />
                    : m === "group" ? <Layers key={m} className="inline size-3.5" aria-label={t("In a group")} />
                    : m === "repeater" ? <Repeat key={m} className="inline size-3.5" aria-label={t("Repeater")} />
                    : <Users key={m} className="inline size-3.5" aria-label={t("Accompanying guests")} />,
                  )}
                </td>
                <td className="px-2 py-1">{r.guest_name}</td>
                <td className="whitespace-nowrap px-2 py-1">{day(r.check_in_date)}</td>
                <td className="whitespace-nowrap px-2 py-1">{day(r.check_out_date)}</td>
                <td className="px-2 py-1">{r.company ?? ""}</td>
                <td className="whitespace-nowrap px-2 py-1">{r.room_type ?? ""}{r.room_number ? ` [${r.room_number}]` : ""}</td>
                <td className="px-2 py-1">{r.channel || r.source || ""}</td>
                <td className="px-2 py-1" title={r.status}>{STATUS_SHORT[r.status] ?? r.status}</td>
                <td className="px-2 py-1 text-right">{money(r.room_rate)}</td>
                <td className="px-2 py-1 text-right">{money(r.balance)}</td>
                <td className="px-2 py-1 text-right">{money(r.deposit)}</td>
                <td className="px-2 py-1">{r.ota_ref ?? ""}</td>
                <td className="px-2 py-1">{r.nationality ?? ""}</td>
                <td className="px-2 py-1">{r.guest_class ?? ""}</td>
                <td className="whitespace-nowrap px-2 py-1">{r.name}</td>
              </tr>
            ))}
            {res && res.rows.length === 0 && !busy ? (
              <tr><td colSpan={16} className="px-2 py-6 text-center text-zinc-600">{t("No booking found.")}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <Sheet wide title={`${open.guest_name} · ${open.name}`} onClose={() => setOpen(null)}>
          <ReservationDetail row={{ ...open }} reload={() => run(f)} onClose={() => setOpen(null)} />
        </Sheet>
      ) : null}
    </div>
  )
}
