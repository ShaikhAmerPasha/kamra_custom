/*  Basic details at the top of Kamra's reservation screen (Kamra Custom): booking number,
    guest, phone and email, and a Send button that sends the confirmation by download,
    WhatsApp or email. The server side is kamra_custom.confirmation. */

import { useEffect, useRef, useState } from "react"
import { Download, Mail, MessageCircle, Send, User } from "lucide-react"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { whatsappUrl } from "./confirmation"

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"

interface Shown {
  name: string
  status: string
  guest?: { name?: string; full_name?: string; phone?: string | null; email?: string | null } | null
  guest_name?: string
  source?: string | null
}

export function BasicDetails({ d, onChanged }: { d: Shown; onChanged: () => void }) {
  const [phone, setPhone] = useState(d.guest?.phone ?? "")
  const [email, setEmail] = useState(d.guest?.email ?? "")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPhone(d.guest?.phone ?? "")
    setEmail(d.guest?.email ?? "")
  }, [d.guest?.phone, d.guest?.email, d.name])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menu])

  const changed = phone.trim() !== (d.guest?.phone ?? "") || email.trim() !== (d.guest?.email ?? "")
  const say = (tone: "ok" | "error", text: string) => setNote({ tone, text })
  const why = (e: unknown) => {
    try {
      const body = JSON.parse((e as { body?: string }).body ?? "")
      const msgs = body._server_messages ? JSON.parse(body._server_messages) : []
      return msgs.map((m: string) => JSON.parse(m).message).join(" ").replace(/<[^>]+>/g, "") || "That did not work."
    } catch {
      return "That did not work."
    }
  }

  const save = async () => {
    setBusy(true)
    setNote(null)
    try {
      await call("kamra_custom.confirmation.save_contact", { reservation: d.name, phone, email })
      say("ok", "Phone and email saved.")
      onChanged()
    } catch (e) {
      say("error", why(e))
    } finally {
      setBusy(false)
    }
  }

  const needSaved = () => {
    if (!changed) return false
    say("error", "Save the phone and email first.")
    return true
  }

  const download = () => {
    setMenu(false)
    if (needSaved()) return
    window.open(`/api/method/kamra_custom.confirmation.download?reservation=${encodeURIComponent(d.name)}`, "_blank")
  }

  const whatsapp = async () => {
    setMenu(false)
    if (needSaved()) return
    try {
      const x = await call<{ phone: string; message: string }>("kamra_custom.confirmation.details", { reservation: d.name })
      const url = whatsappUrl(x.phone, x.message)
      if (!url) return say("error", "Add the guest's phone number first.")
      window.open(url, "_blank", "noopener")
      say("ok", "WhatsApp opened with the message ready to send.")
    } catch (e) {
      say("error", why(e))
    }
  }

  const sendEmail = async () => {
    setMenu(false)
    if (needSaved()) return
    setBusy(true)
    try {
      const x = await call<{ to: string }>("kamra_custom.confirmation.send_email", { reservation: d.name })
      say("ok", `Confirmation emailed to ${x.to}.`)
    } catch (e) {
      say("error", why(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4" data-testid="basic-details">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <span className="text-zinc-400">
            <User className="size-4" />
          </span>
          Basic details
        </div>
        <div className="relative" ref={box}>
          <Button variant="outline" onClick={() => setMenu((o) => !o)} aria-haspopup="menu" aria-expanded={menu} data-hk="send">
            <Send className="size-4" aria-hidden />
            Send confirmation
          </Button>
          {menu ? (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
              <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-zinc-50" onClick={download}>
                <Download className="size-4" aria-hidden /> Download PDF
              </button>
              <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-zinc-50" onClick={whatsapp}>
                <MessageCircle className="size-4" aria-hidden /> Send by WhatsApp
              </button>
              <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-zinc-50" onClick={sendEmail}>
                <Mail className="size-4" aria-hidden /> Send by email
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className={label}>Booking</dt>
          <dd className="text-sm font-medium text-zinc-800">{d.name}</dd>
        </div>
        <div>
          <dt className={label}>Guest</dt>
          <dd className="text-sm font-medium text-zinc-800">{d.guest_name ?? d.guest?.full_name ?? d.guest?.name ?? "-"}</dd>
        </div>
        <div>
          <dt className={label}>Status</dt>
          <dd className="text-sm text-zinc-800">{d.status}</dd>
        </div>
        <div>
          <dt className={label}>Source</dt>
          <dd className="text-sm text-zinc-800">{d.source ?? "-"}</dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className={label} htmlFor="basic-phone">Phone</label>
          <input id="basic-phone" className={input} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98450 12345" />
        </div>
        <div>
          <label className={label} htmlFor="basic-email">Email</label>
          <input id="basic-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@example.com" />
        </div>
        <Button onClick={save} disabled={busy || !changed}>
          Save
        </Button>
      </div>
      {note ? (
        <p role={note.tone === "error" ? "alert" : "status"} className={"mt-2 text-sm " + (note.tone === "error" ? "text-rose-700" : "text-emerald-700")}>
          {note.text}
        </p>
      ) : null}
    </div>
  )
}
