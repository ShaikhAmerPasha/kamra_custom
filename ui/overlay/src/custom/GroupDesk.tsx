/*  Group desk (Kamra Custom): MyCloud's Groups screen on one page. The group's master details on the
    left, its rooms on the right with a leader radio, the block summary below. Everything it does is
    Kamra's own group call (assign rooms, check in, set main room, cancel, pays-own-charges); the one
    new thing is sending a master field down to the ticked rooms. The page never scrolls: only the
    rooms list does, inside its own frame, when the group is long. */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { call, getCurrentProperty } from "../lib/api"
import { Sheet } from "../components/ui/sheet"
import { useT } from "../lib/i18n"
import ReservationDetail from "../screens/ReservationDetail"
import { DeskPopup } from "./DeskPopup"
import { ProformaButton } from "./Proforma"
import { toggle, toggleAll, headState } from "./bulk"
import { useFillViewport } from "./useFillViewport"
import {
  EMPTY_SEND, SEND_FIELDS, isOpen, pickupLine, roomLine, roomsTold, sendProblem, sendValues,
  type PickupRow, type RoomResult, type SendField, type SendForm, type Ticked,
} from "./groupDesk"
import "./desk.css"

interface GroupRow { name: string; group_name: string; check_in_date: string; check_out_date: string; status: string }
interface Room {
  name: string; guest_name: string; phone: string | null; room_type: string; room_type_name: string; room: string | null
  room_number: string | null; status: string; check_in_date: string; check_out_date: string
  is_master: boolean; pays_own_charges: number; own_balance: number
}
interface Detail {
  group: {
    name: string; group_name: string; company: string | null; status: string; master_reservation: string | null
    master_pays: string | null; check_in_date: string; check_out_date: string; cutoff_date: string | null
    rooms_total: number; in_house: number; notes: string | null
  }
  pickup: PickupRow[]
  rooming_list: Room[]
  master_folio: string | null
  master_folio_balance: number
}
type Told = { title: string; lines: { ref: string; ok: boolean; text: string }[] } | null

const SEGMENTS = ["Corporate", "Leisure", "Group", "MICE", "Government"]
const day = (d: string) => d.split("-").reverse().join("/")
const errText = (e: unknown) => {
  try {
    const body = JSON.parse((e as { body?: string }).body ?? "")
    const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
    return msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || "That did not work."
  } catch {
    return "That did not work."
  }
}

export default function GroupDesk() {
  const { t } = useT()
  const property = getCurrentProperty()
  const [params, setParams] = useSearchParams()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [d, setD] = useState<Detail | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [told, setTold] = useState<Told>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [open, setOpen] = useState<Room | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [send, setSend] = useState<SendForm>(EMPTY_SEND)
  const [sendTicks, setSendTicks] = useState<Ticked>({})
  const group = params.get("group") ?? ""
  const fill = useFillViewport<HTMLDivElement>()

  useEffect(() => {
    call<GroupRow[]>("frappe.client.get_list", {
      doctype: "Group Booking", filters: { property }, fields: ["name", "group_name", "check_in_date", "check_out_date", "status"],
      order_by: "creation desc", limit_page_length: 100,
    }).then(setGroups).catch(() => setGroups([]))
  }, [property])

  const load = useCallback(() => {
    if (!group) return setD(null)
    call<Detail>("kamra.api.group_detail", { group_booking: group })
      .then((x) => (setD(x), setError(""), setTicked((cur) => cur.filter((n) => x.rooming_list.some((r) => r.name === n)))))
      .catch((e) => (setD(null), setError(errText(e))))
  }, [group])
  useEffect(load, [load])

  const rooms = d?.rooming_list ?? []
  const names = rooms.map((r) => r.name)
  const head = headState(ticked, names)
  const openTicked = useMemo(() => rooms.filter((r) => ticked.includes(r.name) && isOpen(r.status)).map((r) => r.name), [rooms, ticked])

  async function act(label: string, fn: () => Promise<{ results?: RoomResult[] } | unknown>) {
    setBusy(label)
    setError("")
    setTold(null)
    try {
      const out = (await fn()) as { results?: RoomResult[] }
      if (out?.results) {
        setTold({
          title: `${t(label)}: ${t(roomsTold(out.results))}`,
          lines: out.results.map((r) => ({ ref: r.reservation, ...roomLine(r) })),
        })
      }
      load()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy("")
      setConfirmCancel(false)
    }
  }
  const picked = ticked.length ? ticked : undefined

  const ticks = SEND_FIELDS.filter((k) => sendTicks[k])
  const problem = sendProblem(sendTicks, send)
  const sendNow = () =>
    act("Send to rooms", async () => {
      const out = await call<{ results: { reservation: string; guest_name: string; ok: boolean; message: string }[] }>("kamra_custom.groups_desk.download", {
        group_booking: group, reservations: openTicked, values: sendValues(sendTicks, send),
      })
      return { results: out.results.map((r) => (r.ok ? { reservation: `${r.guest_name} · ${r.reservation}`, done: 1 } : { reservation: `${r.guest_name} · ${r.reservation}`, error: r.message })) }
    })

  const tick = (k: SendField) => setSendTicks((s) => ({ ...s, [k]: !s[k] }))
  const rowCtl = (k: SendField, label: string, control: React.ReactNode) => (
    <div className="kd-row" style={{ display: "grid", gridTemplateColumns: "20px 130px minmax(0,1fr)", columnGap: "8px", alignItems: "center" }}>
      <input type="checkbox" aria-label={`${t("Send")} ${t(label)}`} checked={!!sendTicks[k]} onChange={() => tick(k)} />
      <span className="kd-lab text-right text-sm text-zinc-600">{t(label)}</span>
      {control}
    </div>
  )
  const inputCls = "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm"

  const master = d?.group
  return (
    <div ref={fill.ref} className="kd flex flex-col gap-2 overflow-hidden p-3" style={fill.style}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("Groups")}</h1>
        <select aria-label={t("Group")} className="min-w-72 rounded border border-zinc-300 bg-white px-2 py-1 text-sm" value={group}
          onChange={(e) => (setTicked([]), setTold(null), setParams(e.target.value ? { group: e.target.value } : {}, { replace: true }))}>
          <option value="">{t("Choose a group")}</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.group_name} · {day(g.check_in_date)}–{day(g.check_out_date)} · {g.status}</option>)}
        </select>
        <span className="ms-auto flex flex-wrap gap-2">
          <button type="button" className="rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!d || !!busy}
            onClick={() => act("Assign rooms", () => call("kamra.api.group_assign_rooms", { group_booking: group, reservations: picked }))}>
            {busy === "Assign rooms" ? t("Working…") : t("Assign rooms")}
          </button>
          <button type="button" className="rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!d || !!busy}
            onClick={() => act("Check-in", () => call("kamra.api.group_check_in", { group_booking: group, reservations: picked }))}>
            {busy === "Check-in" ? t("Working…") : t("Check-in")}
          </button>
          {confirmCancel ? (
            <button type="button" className="rounded bg-rose-600 px-3 py-1 text-sm text-white" disabled={!!busy}
              onClick={() => act("Cancel rooms", () => call("kamra.api.bulk_stays", { action: "cancel", reservations: openTicked, reason: "Guest request" }))}>
              {t("Yes, cancel {n} rooms", { n: openTicked.length })}
            </button>
          ) : (
            <button type="button" className="rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!openTicked.length || !!busy} onClick={() => setConfirmCancel(true)}>
              {t("Cancel ticked rooms")}
            </button>
          )}
          <ProformaButton kind="group" id={group} label={t("Group proforma")} disabled={!d} className="h-auto px-3 py-1 text-sm" />
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={load} disabled={!d}>{t("Refresh")}</button>
        </span>
      </div>
      <p className="text-xs text-zinc-600">{ticked.length ? t("{n} rooms ticked: actions use them.", { n: ticked.length }) : t("No room ticked: Assign rooms and Check-in use every room of the group.")}</p>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      {told ? (
        <div role="status" className="max-h-24 shrink-0 overflow-auto border p-2 text-sm">
          <p className="font-medium">{told.title}</p>
          <ul>{told.lines.map((l) => <li key={l.ref} className={l.ok ? "text-emerald-700" : "text-rose-700"}>{l.ok ? "✓" : "✗"} {l.ref}: {t(l.text)}</li>)}</ul>
        </div>
      ) : null}

      {!d ? (
        <p className="p-6 text-center text-sm text-zinc-600">{group ? t("Loading…") : t("Choose a group to see its rooms.")}</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-3">
          <div className="flex min-h-0 flex-col gap-2">
            <div data-bar={t("Group details")} className="border p-2 text-sm" style={{ paddingTop: 0 }}>
              <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-1">
                {([
                  ["Group name", master!.group_name], ["Confirmation #", master!.name], ["Arrival", day(master!.check_in_date)],
                  ["Departure", day(master!.check_out_date)], ["Company", master!.company ?? ""], ["Status", master!.status],
                  ["Rooms", `${master!.rooms_total}${master!.in_house ? ` · ${master!.in_house} in-house` : ""}`],
                  ["Main room", rooms.find((r) => r.is_master)?.guest_name ?? ""], ["Main pays", master!.master_pays ?? ""],
                  ["Cut-off", master!.cutoff_date ? day(master!.cutoff_date) : ""],
                  ["Group bill", d.master_folio ? `${d.master_folio} · ${d.master_folio_balance.toLocaleString("en-IN")}` : ""],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-right text-zinc-600">{t(k)}</dt><dd className="truncate" title={v}>{v || "-"}</dd></div>
                ))}
              </dl>
            </div>
            <div className="border p-2">
              <DeskPopup title={t("Send master fields to rooms")} summary={ticks.length ? ticks.map((k) => t(k.replace(/_/g, " "))).join(", ") : ""} addLabel={t("Choose")} wide>
                <p className="text-xs text-zinc-600">{t("Tick a field, set its value, then send it to the ticked rooms. A ticked blank clears the field.")}</p>
                {rowCtl("pay_by", "Pay by", <select className={inputCls} value={send.pay_by} onChange={(e) => setSend({ ...send, pay_by: e.target.value })}>
                  <option value="" />{["Cash", "Card", "UPI", "Bank transfer", "Company", "Credit"].map((p) => <option key={p}>{p}</option>)}</select>)}
                {rowCtl("gst_number", "GST number", <input className={inputCls} maxLength={15} value={send.gst_number} onChange={(e) => setSend({ ...send, gst_number: e.target.value.toUpperCase() })} />)}
                {rowCtl("pan_number", "PAN number", <input className={inputCls} maxLength={10} value={send.pan_number} onChange={(e) => setSend({ ...send, pan_number: e.target.value.toUpperCase() })} />)}
                {rowCtl("credit_limit", "Credit limit", <input className={inputCls} inputMode="decimal" value={send.credit_limit} onChange={(e) => setSend({ ...send, credit_limit: e.target.value })} />)}
                {rowCtl("business_source", "Business source", <input className={inputCls} value={send.business_source} onChange={(e) => setSend({ ...send, business_source: e.target.value })} />)}
                {rowCtl("domicile", "Domicile", <input className={inputCls} value={send.domicile} placeholder="Country" onChange={(e) => setSend({ ...send, domicile: e.target.value })} />)}
                {rowCtl("market_segment", "Market segment", <select className={inputCls} value={send.market_segment} onChange={(e) => setSend({ ...send, market_segment: e.target.value })}>
                  <option value="" />{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select>)}
                {rowCtl("guaranteed", "Guaranteed", <input type="checkbox" checked={send.guaranteed} onChange={(e) => setSend({ ...send, guaranteed: e.target.checked })} />)}
                {rowCtl("tax_exempt", "Tax exempt", <input type="checkbox" checked={send.tax_exempt} onChange={(e) => setSend({ ...send, tax_exempt: e.target.checked })} />)}
                {rowCtl("special_guest", "Special guest", <input type="checkbox" checked={send.special_guest} onChange={(e) => setSend({ ...send, special_guest: e.target.checked })} />)}
                {rowCtl("special_requests", "Guest request", <input className={inputCls} value={send.special_requests} onChange={(e) => setSend({ ...send, special_requests: e.target.value })} />)}
                {problem ? <p role="alert" className="text-rose-700">{t(problem)}</p> : null}
                <button type="button" className="rounded bg-brand-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={!!busy || !ticks.length || !openTicked.length || problem !== ""} onClick={sendNow}>
                  {t("Send to {n} ticked rooms", { n: openTicked.length })}
                </button>
              </DeskPopup>
              <p className="mt-1 text-xs text-zinc-600">{t("Sends the chosen fields to the ticked rooms.")}</p>
            </div>
            <div data-bar={t("Group block summary")} className="border p-2 text-sm" style={{ paddingTop: 0 }}>
              {d.pickup.length ? <ul>{d.pickup.map((p) => <li key={p.room_type}>{pickupLine(p)}</li>)}</ul> : <p className="text-zinc-600">{t("No rooms are blocked for this group.")}</p>}
            </div>
          </div>

          <div className="min-h-0 overflow-auto border" aria-label={t("Group members")}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-brand-600 text-left text-white">
                <tr>
                  <th className="px-2 py-1"><input type="checkbox" aria-label={t("Tick all")} checked={head === "all"} ref={(el) => { if (el) el.indeterminate = head === "some" }} onChange={() => setTicked(toggleAll(ticked, names))} /></th>
                  {["Guest name", "Room type", "Room", "Arrival", "Departure", "Status", "Leader", "Pays own", "Own balance", ""].map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h ? t(h) : ""}</th>)}
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="px-2 py-1"><input type="checkbox" aria-label={`${t("Tick")} ${r.name}`} checked={ticked.includes(r.name)} onChange={() => setTicked(toggle(ticked, r.name))} /></td>
                    <td className="px-2 py-1">{r.guest_name}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.room_type_name}</td>
                    <td className="px-2 py-1">{r.room_number ?? ""}</td>
                    <td className="whitespace-nowrap px-2 py-1">{day(r.check_in_date)}</td>
                    <td className="whitespace-nowrap px-2 py-1">{day(r.check_out_date)}</td>
                    <td className="px-2 py-1">{r.status}</td>
                    <td className="px-2 py-1"><input type="radio" name="leader" aria-label={`${t("Leader")} ${r.guest_name}`} checked={r.is_master} disabled={!!busy || !isOpen(r.status)}
                      onChange={() => act("Main room", () => call("kamra.api.set_group_master", { group_booking: group, reservation: r.name }))} /></td>
                    <td className="px-2 py-1"><input type="checkbox" aria-label={`${t("Pays own charges")} ${r.guest_name}`} checked={!!r.pays_own_charges} disabled={!!busy || !isOpen(r.status)}
                      onChange={(e) => act("Pays own charges", () => call("kamra.api.set_pays_own_charges", { reservation: r.name, value: e.target.checked ? 1 : 0 }))} /></td>
                    <td className="px-2 py-1 text-right">{r.own_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1"><button type="button" className="rounded border px-2 text-xs" onClick={() => setOpen(r)}>{t("Open")}</button></td>
                  </tr>
                ))}
                {!rooms.length ? <tr><td colSpan={11} className="px-2 py-6 text-center text-zinc-600">{t("This group has no rooms yet.")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open ? (
        <Sheet wide title={`${open.guest_name} · ${open.name}`} onClose={() => setOpen(null)}>
          <ReservationDetail row={{ ...open }} reload={load} onClose={() => setOpen(null)} />
        </Sheet>
      ) : null}
    </div>
  )
}
