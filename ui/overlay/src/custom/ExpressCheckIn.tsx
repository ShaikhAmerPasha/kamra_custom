/*  Two-page check-in (Kamra Custom), for hotels that ask only for name, ID, room and signature.
    Page 1: the guest's ID and the room. Page 2: the guest signs, then Check in.
    It uses Kamra's own check-in calls, one after another, so the records are the same as the
    six-step check-in leaves: nothing is skipped silently, steps not asked are marked as skipped with a reason. */

import { hkLabel } from "./roomStatus"
import { useCallback, useEffect, useRef, useState } from "react"
import { CircleCheck, Printer } from "lucide-react"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { toFullPath } from "../lib/routing"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { DeskPage } from "./DeskPage"
import { SignaturePad } from "../components/SignaturePad"
import { IdDocumentField } from "../components/IdDocumentField"
import DepositPanel, { type DepositState } from "../components/DepositPanel"
import SecurityDepositPanel, { type SecurityDepositState } from "../components/SecurityDepositPanel"
import TillCard, { type TillState } from "../components/TillCard"
import CheckInGuests, { type GuestOccupant } from "../components/CheckInGuests"
import { ComplimentaryBox } from "./CustomComplimentary"
import { useFlags } from "./flags"
import { checkInProblems, defaultRoom, isCleanRoom, matchRoom } from "./expressCheckIn"
import { cur } from "../lib/money"
import { showStay } from "./showDate"
import { StayChecklist, useStayInfo } from "./StayChecklist"
import { StayDetails } from "./StayDetails"
import { StayFacts } from "./StayFacts"
import { FormViewSwitch, useFormView } from "./FormViewSwitch"
import { checkInItems } from "./stayChecks"
import { depositNotice, securityInUse } from "./depositNotice"

interface Flow {
  reservation: { name: string; guest_name: string; room_type: string; check_in_date: string; check_out_date: string; nights: number; adults: number; children: number }
  guest: { name: string | null; email?: string | null; full_name: string; has_photo: boolean; phone: string | null; nationality: string | null; id_type: string | null; id_on_file: boolean; id_number: string | null }
  ids: { ok: boolean; missing: string[]; occupants: GuestOccupant[] }
  vocabulary: { id_types: string[] }
  steps: { step_key: string; relevant: 0 | 1; state: string }[]
  rooms: { name: string; room_number: string; housekeeping_status: string }[]
  room: { room: string | null; room_number: string | null; housekeeping_status: string | null; room_type_name: string | null }
  billing: { payer: string }
  grc: { signed: boolean }
  deposit: { applies: boolean; satisfied: boolean; security: SecurityDepositState; advance: DepositState; security_due: number; advance_due: number }
  till: TillState
}

const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

export default function ExpressCheckIn(props: { reservation: string; onDone: () => void; onClose: () => void }) {
  const { t } = useT()
  const flags = useFlags()
  const [flow, setFlow] = useState<Flow | null>(null)
  // the ID page comes first only while an ID is missing; once it is done the guest never sees it again
  const [step, setStep] = useState<"id" | "stay" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<string | null | false>(false)
  const [idType, setIdType] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [contact, setContact] = useState({ phone: "", email: "", nationality: "" })
  // what an ID scan read: kept to send with the details
  const [scanned, setScanned] = useState<{ date_of_birth?: string | null; gender?: string | null; id_expiry_date?: string | null; address?: string | null; city?: string | null } | null>(null)
  const [room, setRoom] = useState("")
  // the room number typed by the desk; the cards below are the lookup list
  const [typedRoom, setTypedRoom] = useState("")
  // guided (two pages) or full form (one page), as this person prefers
  const [view, setView] = useFormView()
  const flagsRef = useRef(flags.clean_rooms_only)
  flagsRef.current = flags.clean_rooms_only
  const [signature, setSignature] = useState("")
  const [onPaper, setOnPaper] = useState(false)
  const info = useStayInfo(props.reservation)

  const load = useCallback(async () => {
    try {
      const f = await call<Flow>("kamra.checkin.checkin_flow", { reservation: props.reservation })
      setFlow(f)
      setIdType((v) => v || f.guest.id_type || "")
      setContact((c) => ({ phone: c.phone || f.guest.phone || "", email: c.email || f.guest.email || "", nationality: c.nationality || f.guest.nationality || "" }))
      // the desk only confirms: the first clean room is already chosen
      if (!f.room.room) {
        const first = defaultRoom(f.rooms, flagsRef.current)
        setRoom((v) => v || first)
        // show the chosen room's number in the typed field too, so the desk sees what was picked
        setTypedRoom((v) => v || (f.rooms.find((x) => x.name === first)?.room_number ?? ""))
      }
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
    othersMissing: flow.ids.missing.filter((n) => n !== r.guest_name),
  })
  const idProblems = problems.filter((p) => p.topic === "id")
  const stayProblems = problems.filter((p) => p.topic !== "id")
  const idDone = flow.guest.id_on_file && flow.ids.ok
  const full = view === "full"
  const current: "id" | "stay" = step ?? (idDone ? "stay" : "id")
  const shownProblem = full ? problems[0] : (current === "id" ? idProblems : stayProblems)[0]

  /** Keep the ID the desk typed, so it is done for good, then go on to the room and signature. */
  async function saveIdAndContinue() {
    setBusy(true)
    setError("")
    try {
      if (idType && idNumber.trim()) {
        await call("kamra.checkin.save_guest_details", { reservation: props.reservation, id_type: idType, id_number: idNumber.trim() })
      }
      await load()
      setStep("stay")
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }
  const title = t("Check in {name}", { name: r.guest_name })
  const description = `${flow.room.room_type_name ?? r.room_type} · ${showStay(r.check_in_date, r.check_out_date)} · ${r.adults + r.children} ${t("guests")}`

  /** Each of Kamra's steps for this guest, in order. A step that fails stops the check-in with its own message. */
  async function checkIn() {
    if (!flow || problems.length) return
    setBusy(true)
    setError("")
    const base = { reservation: props.reservation }
    const stepOpen = (key: string) => flow.steps.some((s) => s.step_key === key && s.relevant && s.state !== "done")
    try {
      const changed = (contact.phone && contact.phone !== (flow.guest.phone ?? "")) || (contact.email && contact.email !== (flow.guest.email ?? "")) ||
        (contact.nationality && contact.nationality !== (flow.guest.nationality ?? ""))
      if ((idType && idNumber.trim()) || changed) {
        await call("kamra.checkin.save_guest_details", {
          ...base,
          phone: contact.phone || undefined, email: contact.email || undefined, nationality: contact.nationality || undefined,
          id_type: idType && idNumber.trim() ? idType : undefined, id_number: idNumber.trim() || undefined,
          date_of_birth: scanned?.date_of_birth ?? undefined, gender: scanned?.gender ?? undefined,
          id_expiry_date: scanned?.id_expiry_date ?? undefined, address_line: scanned?.address || undefined, city: scanned?.city || undefined,
        })
      }
      if (stepOpen("guest_ids")) await call("kamra.checkin.complete_checkin_step", { ...base, step: "guest_ids", note: "Name and ID" })
      if (stepOpen("billing_check")) await call("kamra.checkin.confirm_billing", { ...base, payer: flow.billing.payer })
      if (!hasRoom) await call("kamra.checkin.assign_checkin_room", { ...base, room })
      if (signature) await call("kamra.checkin.sign_registration_card", { ...base, signature })
      else if (onPaper) await call("kamra.checkin.sign_registration_card", { ...base, on_paper: 1 })
      // a required deposit is done only when taken or waived: it cannot be skipped, so it is left for Kamra's
      // "Finish check-in" reminder when the desk chooses to check in first
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
    const rows: [string, string][] = [
      [t("Guest"), r.guest_name],
      ...(done ? ([[t("Room"), done]] as [string, string][]) : []),
      [t("Stay"), `${showStay(r.check_in_date, r.check_out_date)} · ${r.nights} ${r.nights === 1 ? t("night") : t("nights")}`],
    ]
    return (
      <div className="kd kd-modal" role="dialog" aria-modal="true" aria-label={title as string}>
        <div className="kd-done">
          <div className="flex items-center gap-2 text-emerald-700">
            <CircleCheck className="size-6 shrink-0" aria-hidden />
            <p className="text-lg font-semibold">
              {done ? t("{name} is checked in to room {room}", { name: r.guest_name, room: done }) : t("{name} is checked in", { name: r.guest_name })}
            </p>
          </div>
          <dl className="grid gap-1 text-sm" style={{ gridTemplateColumns: "90px minmax(0,1fr)" }}>
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a href={toFullPath(`/grc/${r.name}`)} target="_blank" rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-zinc-300 px-3 text-sm font-medium">
              <Printer className="size-4" aria-hidden /> {t("Print registration card")}
            </a>
            <Button className="ms-auto h-9 px-6 text-sm" onClick={props.onDone} autoFocus>{t("Done")}</Button>
          </div>
        </div>
      </div>
    )
  }

  const Shell = full ? DeskPage : Sheet
  return (
    <Shell
      wide
      title={title}
      description={description}
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          {error ? (
            <p role="alert" className="me-auto text-sm text-rose-700">{error}</p>
          ) : shownProblem ? (
            <p role="status" className="me-auto text-sm font-medium text-amber-700">{shownProblem.message}</p>
          ) : (
            <span className="me-auto text-xs text-zinc-500">{full ? t("Everything on one page") : current === "id" ? t("Step 1 of 2: ID") : step === "stay" ? t("Step 2 of 2: room and signature") : t("Room and signature")}</span>
          )}
          {!full && current === "stay" && step === "stay" ? <Button variant="outline" onClick={() => setStep("id")}>{t("Back")}</Button> : null}
          {!full && current === "id" ? (
            <Button className="px-6 py-2.5 text-base" disabled={busy || idProblems.length > 0} onClick={saveIdAndContinue}>{busy ? t("Saving…") : t("Next")}</Button>
          ) : (
            <Button className="px-6 py-2.5 text-base" disabled={busy || problems.length > 0} onClick={checkIn}>
              {busy ? t("Checking in…") : t("Check in")}
            </Button>
          )}
        </div>
      }
    >
      <div className={full ? "kd-grid" : "space-y-5"}>
          <div className="kd-wide flex"><FormViewSwitch view={view} onChange={setView} /></div>
          {info && (full ? <StayDetails detail={info.detail} dense /> : <StayDetails detail={info.detail} />)}
        {info && <div data-bar={full ? "Price night by night" : undefined}><StayFacts reservation={info.detail.name} /></div>}
          {info && (
            <div data-bar={full ? "Checks" : undefined}><StayChecklist
              mode="in"
              items={checkInItems({ ...info, idMissing: !(idDone || (idType !== "" && idNumber.trim() !== "" && flow.ids.ok)), ownIdOnFile: flow.guest.id_on_file, othersMissing: flow.ids.missing.filter((n) => n !== r.guest_name).length })}
              money={(n) => `${cur()}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            /></div>
          )}
        <div className={full ? "kd-flat" : "space-y-5"}>
        {(current === "id" || full) && (
          <div className={full ? "kd-flat" : "space-y-5"}>
          <section data-bar={full ? "Guest ID" : undefined} className="space-y-3">
            <h3 className="kd-hide text-sm font-semibold text-zinc-800">{t("Guest ID")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["phone", "Phone"], ["email", "Email"], ["nationality", "Nationality"]] as const).map(([k, lab]) => (
                <div className="kd-row" key={k}>
                  <label className={label + " kd-lab"} htmlFor={`x-${k}`}>{t(lab)}</label>
                  <input id={`x-${k}`} className={input} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} />
                </div>
              ))}
              <div className="kd-row">
                <label className={label + " kd-lab"} htmlFor="x-id-type">{t("ID type")}</label>
                <select id="x-id-type" className={input} value={idType} onChange={(e) => setIdType(e.target.value)}>
                  <option value="">{t("Choose…")}</option>
                  {flow.vocabulary.id_types.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                </select>
              </div>
              <div className="kd-row">
                <label className={label + " kd-lab"} htmlFor="x-id-number">
                  {flow.guest.id_on_file ? t("New ID number (leave empty to keep)") : t("ID number")}
                </label>
                <input id="x-id-number" className={input} autoComplete="off" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
            </div>
            <IdDocumentField
              method="kamra.api.upload_id_document"
              params={{ reservation: r.name }}
              uploaded={flow.guest.id_on_file}
              onUploaded={load}
              label={t("Photograph the guest's ID")}
            />
          </section>

          {(
            <section data-bar={full ? "Everyone staying" : undefined} className="space-y-3">
              <CheckInGuests
                key={flow.ids.occupants.map((o) => o.row).join(",")}
                reservation={r.name}
                guest={flow.guest.name}
                guestName={flow.guest.full_name ?? r.guest_name}
                guestHasPhoto={flow.guest.has_photo}
                adults={r.adults}
                children={r.children}
                occupants={flow.ids.occupants}
                idTypes={flow.vocabulary.id_types}
                onChanged={load}
                onMainRead={(read) => {
                  setIdType((v) => read.id_type || v)
                  setIdNumber((v) => read.id_number || v)
                  setContact((c) => ({ ...c, nationality: read.nationality ?? c.nationality }))
                  setScanned(read)
                }}
              />
            </section>
          )}

          </div>
        )}
        {(current === "stay" || full) && (
          <div className={full ? "kd-flat" : "space-y-5"}>
          {flow.deposit.applies && (securityInUse(flow.deposit.security) || flow.deposit.advance_due > 0) && (
            <section data-bar={full ? "Deposit and advance" : undefined} className="space-y-3">
              {depositNotice(flow.deposit).kind === "due" && <TillCard till={flow.till} onOpened={load} purpose={t("to take the deposit")} />}
              {securityInUse(flow.deposit.security) && (
                <SecurityDepositPanel reservation={r.name} deposit={flow.deposit.security} canStart onChanged={load} />
              )}
              {flow.deposit.advance_due > 0 && (
                <DepositPanel reservation={r.name} deposit={flow.deposit.advance} guestPhone={flow.guest.phone} onChanged={() => load()} />
              )}
              {(() => {
                const n = depositNotice(flow.deposit)
                if (n.kind === "none") return null
                return (
                  <p className={n.kind === "due" ? "text-sm font-medium text-amber-700" : "text-sm text-emerald-700"}>
                    {n.kind === "waived" ? t("Security deposit waived.")
                      : n.kind === "taken" ? t("Security deposit is taken.")
                        : t("{amount} security deposit still to collect. Take it or waive it with a reason. You can also check in now and finish it later.", { amount: `${cur()}${Math.round(n.amount).toLocaleString("en-IN")}` })}
                  </p>
                )
              })()}
            </section>
          )}

          <section data-bar={full ? "Room" : undefined} className="space-y-3">
            <h3 className="kd-hide text-sm font-semibold text-zinc-800">{t("Room")}</h3>
            {hasRoom ? (
              <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-semibold">
                {t("Room {n}", { n: flow.room.room_number ?? "" })}
              </p>
            ) : flow.rooms.length === 0 ? (
              <p className="text-sm text-rose-700">{t("No free room of this type for these dates.")}</p>
            ) : (
              <>
              <div className="max-w-xs">
                <label htmlFor="typed-room" className="mb-1 block text-xs text-zinc-500">{t("Room number (type it, or pick below)")}</label>
                <input
                  id="typed-room"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-brand-600"
                  value={typedRoom}
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = e.target.value
                    setTypedRoom(v)
                    const m = matchRoom(flow.rooms, v, !!flags.clean_rooms_only)
                    if (m.room) setRoom(m.room)
                  }}
                />
                {(() => {
                  const m = matchRoom(flow.rooms, typedRoom, !!flags.clean_rooms_only)
                  return m.problem ? <p role="alert" className="mt-1 text-xs text-amber-700">{t(m.problem)}</p> : null
                })()}
              </div>
              <div className="kd-keep grid grid-cols-2 gap-2 sm:grid-cols-4">
                {flow.rooms.map((x) => {
                  const blocked = flags.clean_rooms_only && !isCleanRoom(x.housekeeping_status)
                  return (
                    <button
                      key={x.name}
                      type="button"
                      disabled={blocked}
                      aria-pressed={room === x.name}
                      onClick={() => {
                        setRoom(x.name)
                        setTypedRoom(x.room_number)
                      }}
                      className={cn(
                        "rounded-xl border p-3 text-start transition disabled:opacity-40",
                        room === x.name ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-zinc-200 bg-white hover:border-brand-300",
                      )}
                    >
                      <span className="block text-lg font-semibold">{x.room_number}</span>
                      <span className="text-xs text-zinc-500">{t(hkLabel(x.housekeeping_status) || "Unknown")}</span>
                    </button>
                  )
                })}
              </div>
              </>
            )}
          </section>

          <ComplimentaryBox reservation={props.reservation} onChanged={load} />

          <dl data-bar={full ? "Summary" : undefined} className={(full ? "kd-hide " : "") + "divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-4 text-sm"}>
            {[
              [t("Guest"), r.guest_name],
              [t("ID"), flow.guest.id_on_file && !idNumber ? t("On file") : `${idType} ${idNumber ? "•••" + idNumber.slice(-4) : ""}`],
              [t("Room"), hasRoom ? flow.room.room_number : flow.rooms.find((x) => x.name === room)?.room_number],
              [t("Stay"), showStay(r.check_in_date, r.check_out_date)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {flow.grc.signed && !signature ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {t("The guest already signed (online or earlier). Check in, or ask them to sign again below.")}
            </p>
          ) : null}
          <div data-bar={full ? "Guest signs here" : undefined}>
            <p className="kd-hide mb-1 text-sm font-medium text-zinc-700">{t("Guest signs here")}</p>
            <SignaturePad onChange={setSignature} />
            <label className="mt-1 flex items-center gap-2 text-base">
              <input type="checkbox" className="size-5" checked={onPaper} onChange={(e) => setOnPaper(e.target.checked)} />
              {t("The guest signed the printed card")}
            </label>
          </div>
          </div>
        )}
        </div>
      </div>
    </Shell>
  )
}
