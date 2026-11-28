/*  "Possible duplicate guests" on Guest History (Kamra Custom). Shows nothing when there are none, or when the
    user may not merge. Each group lists the profiles with their stays; the desk picks the one to keep, gives a
    reason and confirms. The server refuses profiles with different phone numbers and guests in house. */
import { useCallback, useEffect, useState } from "react"
import { Users } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { useT } from "../lib/i18n"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { showDate } from "./showDate"
import { confirmText, reasonOk, toRemove, type DupGroup } from "./guestMerge"

export function DuplicateGuests(props: { onMerged: () => void }) {
  const { t } = useT()
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [open, setOpen] = useState(false)
  const [keep, setKeep] = useState<Record<number, string>>({})
  const [ask, setAsk] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    call<DupGroup[]>("kamra_custom.guest_merge.duplicates", { property: getCurrentProperty() })
      .then((g) => { setGroups(g); setKeep(Object.fromEntries(g.map((x, i) => [i, x.keep]))) })
      .catch(() => setGroups([]))
  }, [])
  useEffect(load, [load])

  if (!groups.length) return null
  const g = ask === null ? null : groups[ask]

  const run = async () => {
    if (!g || ask === null) return
    setBusy(true)
    setError("")
    try {
      for (const m of toRemove(g, keep[ask])) {
        await call("kamra_custom.guest_merge.merge", { keep: keep[ask], remove: m.name, reason: reason.trim() })
      }
      setAsk(null)
      setReason("")
      load()
      props.onMerged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <button type="button" className="flex w-full items-center gap-2 text-start font-medium" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Users className="size-4 shrink-0" aria-hidden />
        {groups.length === 1 ? t("1 guest may be on file twice") : t("{n} guests may be on file twice", { n: groups.length })}
        <span className="ms-auto text-xs underline">{open ? t("Hide") : t("Review")}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-3">
          {groups.map((grp, i) => (
            <li key={grp.members.map((m) => m.name).join()} className="rounded-lg bg-white p-3 text-zinc-800">
              <p className="mb-2 text-xs text-zinc-500">{t("Same name. Choose the profile to keep.")}</p>
              {grp.members.map((m) => (
                <label key={m.name} className="flex cursor-pointer items-center gap-3 border-t border-zinc-100 py-1.5 first:border-t-0">
                  <input type="radio" name={`keep-${i}`} checked={keep[i] === m.name} onChange={() => setKeep((k) => ({ ...k, [i]: m.name }))} />
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-xs text-zinc-500">{m.phone || t("no phone")}{m.email ? ` · ${m.email}` : ""}</span>
                  <span className="ms-auto text-xs text-zinc-500">
                    {m.stays} {m.stays === 1 ? t("booking") : t("bookings")}{m.last_stay ? ` · ${showDate(m.last_stay)}` : ""}
                  </span>
                </label>
              ))}
              {grp.can_merge ? (
                <Button className="mt-2" onClick={() => { setAsk(i); setReason(""); setError("") }}>{t("Join into the kept profile")}</Button>
              ) : (
                <p className="mt-2 text-xs text-rose-700">{t(grp.blocked)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {g && ask !== null && (
        <Sheet
          title={t("Join duplicate guest profiles")}
          onClose={() => setAsk(null)}
          footer={
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" className="ms-auto" onClick={() => setAsk(null)}>{t("Keep both")}</Button>
              <Button disabled={busy || !reasonOk(reason)} onClick={run}>{busy ? t("Joining…") : t("Join profiles")}</Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            <p>{t(confirmText(g, keep[ask]))}</p>
            <div>
              <label htmlFor="merge-reason" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">{t("Why are they the same person? (required)")}</label>
              <textarea id="merge-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:outline-2 focus:outline-offset-1 focus:outline-brand-600" />
            </div>
            {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
          </div>
        </Sheet>
      )}
    </div>
  )
}
