/*  A small search box above a desk list (Kamra Custom). */
import { Search } from "lucide-react"
import { useT } from "../lib/i18n"

export function DeskSearchBox(props: { value: string; onChange: (v: string) => void }) {
  const { t } = useT()
  return (
    <label className="relative block sm:max-w-xs">
      <span className="sr-only">{t("Find in this list")}</span>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      <input
        type="search"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={t("Guest, room, phone, company")}
        className="w-full rounded-lg border border-zinc-300 bg-white py-2 ps-8 pe-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
      />
    </label>
  )
}
