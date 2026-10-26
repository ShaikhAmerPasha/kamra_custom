/*  Two-page check-in (Kamra Custom), for hotels that ask only for name, ID, room and signature.
    Page 1: the guest's ID and the room. Page 2: the guest signs, then Check in.
    It uses Kamra's own check-in calls, one after another, so the records are the same as the
    six-step check-in leaves: nothing is skipped silently, steps not asked are marked as skipped with a reason. */

import { useCallback, useEffect, useState } from "react"
import { CircleCheck, Printer } from "lucide-react"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { toFullPath } from "../lib/routing"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { SignaturePad } from "../components/SignaturePad"
import { ComplimentaryBox } from "./CustomComplimentary"
import { useFlags } from "./flags"
import { checkInProblems, isCleanRoom } from "./expressCheckIn"

interface Flow {
  reservation: { name: string; guest_name: string; room_type: string; check_in_date: string; check_out_date: string; nights: number; adults: number; children: number }
  guest: { phone: string | null; nationality: string | null; id_type: string | null; id_on_file: boolean; id_number: string | null }
  vocabulary: { id_types: string[] }
  steps: { step_key: string; relevant: 0 | 1; state: string }[]
  rooms: { name: string; room_number: string; housekeeping_status: string }[]
  room: { room: string | null; room_number: string | null; housekeeping_status: string | null; room_type_name: string | null }
  billing: { payer: string }
  grc: { signed: boolean }
}

const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

export default function ExpressCheckIn(props: { reservation: string; onDone: () => void; onClose: () => void }) {
  const { t } = useT()
  const flags = useFlags()
  const [flow, setFlow] = useState<Flow | null>(null)
  const [page, setPage] = useState<1 | 2>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<string | null | false>(false)
  const [idType, setIdType] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [room, setRoom] = useState("")
  const [signature, setSignature] = useState("")
  const [onPaper, setOnPaper] = useState(false)

  const load = useCallback(async () => {
    try {
      const f = await call<Flow>("kamra.checkin.checkin_flow", { reservation: props.reservation })
      setFlow(f)
      setIdType((v) => v || f.guest.id_type || "")
    } catch (e) {
      setError(serverError(e))
    }
  }, [props.reservation])
  useEffect(() => {
    load()
  }, [load])

  if (!flow) {
    return (
      <Sheet wide title={t("Check in")} onClose={props.onClose}>
        {error ? <p role="alert" className="text-rose-700">{error}</p> : <p className="text-zinc-500">{t("Loading…")}</p>}
      </Sheet>
    )
  }

  const r = flow.reservation
  const hasRoom = !!flow.room.room
  const problems = checkInProblems({
    name: r.guest_name, idOnFile: flow.guest.id_on_file, idType, idNumber,
    hasRoom, pickedRoom: room, signed: !!signature || onPaper || flow.grc.signed,
  })
  const page1Problem = problems.find((p) => p.page === 1)
  const title = t("Check in {name}", { name: r.guest_name })
  const description = `${flow.room.room_type_name ?? r.room_type} · ${r.check_in_date} → ${r.check_out_date} · ${r.adults + r.children} ${t("guests")}`

  /** Each of Kamra's steps for this guest, in order. A step that fails stops the check-in with its own message. */
  async function checkIn() {
    if (!flow || problems.length) return
    setBusy(true)
    setError("")
    const base = { reservation: props.reservation }
    const stepOpen = (key: string) => flow.steps.some((s) => s.step_key === key && s.relevant && s.state !== "done")
    try {
      if (idType && idNumber.trim()) {
        await call("kamra.checkin.save_guest_details", { ...base, id_type: idType, id_number: idNumber.trim() })
      }
      if (stepOpen("guest_ids")) await call("kamra.checkin.complete_checkin_step", { ...base, step: "guest_ids", note: "Name and ID" })
      if (stepOpen("billing_check")) await call("kamra.checkin.confirm_billing", { ...base, payer: flow.billing.payer })
      if (!hasRoom) await call("kamra.checkin.assign_checkin_room", { ...base, room })
      if (signature) await call("kamra.checkin.sign_registration_card", { ...base, signature })
      else if (onPaper) await call("kamra.checkin.sign_registration_card", { ...base, on_paper: 1 })
      if (stepOpen("security_deposit")) {
        await call("kamra.checkin.skip_checkin_step", { ...base, step: "security_deposit", reason: "No deposit at this hotel: advance only" })
      }
      if (stepOpen("room_charges")) await call("kamra.checkin.set_room_charges", { ...base, allowed: 1 })
      const out = await call<{ room: string | null }>("kamra.api.check_in", base)
      setDone(out.room ? (flow.rooms.find((x) => x.name === out.room)?.room_number ?? flow.room.room_number ?? out.room) : null)
    } catch (e) {
      setError(serverError(e))
      load()
    } finally {
      setBusy(false)
    }
  }

  if (done !== false) {
    return (
      <Sheet
        wide
        title={title}
        description={description}
        onClose={props.onDone}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <a href={toFullPath(`/grc/${r.name}`)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Printer className="size-4" aria-hidden /> {t("Print registration card")}
            </a>
            <Button className="ms-auto px-6 py-2.5 text-base" onClick={props.onDone}>{t("Done")}</Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-lg font-semibold">
            {done ? t("{name} is checked in to room {room}", { name: r.guest_name, room: done }) : t("{name} is checked in", { name: r.guest_name })}
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      wide
      title={title}
      description={description}
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          {error ? <p role="alert" className="me-auto text-sm text-rose-700">{error}</p> : <span className="me-auto text-xs text-zinc-500">{t("Page {n} of 2", { n: page })}</span>}
          {page === 2 ? <Button variant="outline" onClick={() => setPage(1)}>{t("Back")}</Button> : null}
          {page === 1 ? (
            <Button className="px-6 py-2.5 text-base" disabled={!!page1Problem} onClick={() => setPage(2)}>{t("Next")}</Button>
          ) : (
            <Button className="px-6 py-2.5 text-base" disabled={busy || problems.length > 0} onClick={checkIn}>
              {busy ? t("Checking in…") : t("Check in")}
            </Button>
          )}
        </div>
      }
    >
      {page === 1 ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800">{t("Guest ID")}</h3>
            <p className="text-sm text-zinc-600">{r.guest_name}{flow.guest.phone ? ` · ${flow.guest.phone}` : ""}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="x-id-type">{t("ID type")}</label>
                <select id="x-id-type" className={input} value={idType} onChange={(e) => setIdType(e.target.value)}>
                  <option value="">{t("Choose…")}</option>
                  {flow.vocabulary.id_types.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="x-id-number">
                  {flow.guest.id_on_file ? t("New ID number (leave empty to keep)") : t("ID number")}
                </label>
                <input id="x-id-number" className={input} autoComplete="off" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800">{t("Room")}</h3>
            {hasRoom ? (
              <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-semibold">
                {t("Room {n}", { n: flow.room.room_number ?? "" })}
              </p>
            ) : flow.rooms.length === 0 ? (
              <p className="text-sm text-rose-700">{t("No free room of this type for these dates.")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {flow.rooms.map((x) => {
                  const blocked = flags.clean_rooms_only && !isCleanRoom(x.housekeeping_status)
                  return (
                    <button
                      key={x.name}
                      type="button"
                      disabled={blocked}
                      aria-pressed={room === x.name}
                      onClick={() => setRoom(x.name)}
                      className={cn(
                        "rounded-xl border p-3 text-start transition disabled:opacity-40",
                        room === x.name ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-zinc-200 bg-white hover:border-brand-300",
                      )}
                    >
                      <span className="block text-lg font-semibold">{x.room_number}</span>
                      <span className="text-xs text-zinc-500">{t(x.housekeeping_status || "Unknown")}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <ComplimentaryBox reservation={props.reservation} onChanged={load} />
          {page1Problem ? <p className="text-sm text-zinc-500">{page1Problem.message}</p> : null}
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-4 text-sm">
            {[
              [t("Guest"), r.guest_name],
              [t("ID"), flow.guest.id_on_file && !idNumber ? t("On file") : `${idType} ${idNumber ? "•••" + idNumber.slice(-4) : ""}`],
              [t("Room"), hasRoom ? flow.room.room_number : flow.rooms.find((x) => x.name === room)?.room_number],
              [t("Stay"), `${r.check_in_date} → ${r.check_out_date}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {flow.grc.signed && !signature ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {t("The guest already signed (online or earlier). Check in, or ask them to sign again below.")}
            </p>
          ) : null}
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">{t("Guest signs here")}</p>
            <SignaturePad onChange={setSignature} />
          </div>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="size-5" checked={onPaper} onChange={(e) => setOnPaper(e.target.checked)} />
            {t("The guest signed the printed card")}
          </label>
        </div>
      )}
    </Sheet>
  )
}
