/*  "More" menu for the bill's less used actions (Kamra Custom). The bill header had a dozen buttons in a row,
    so the two that matter (take payment, close and invoice) were hard to find. The buttons put inside keep
    their own behaviour; this only gathers them. Closes on a click inside, a click outside, or Escape. */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { useT } from "../lib/i18n"
import { Button } from "../components/ui/button"

export function FolioMore({ children }: { children: ReactNode }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", key)
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key) }
  }, [open])

  return (
    <div ref={box} className="relative print:hidden" data-folio-more>
      <Button variant="outline" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t("More")}
        <ChevronDown className="size-4" aria-hidden />
      </Button>
      {open && (
        <div role="menu" onClick={() => setOpen(false)}
          className="absolute end-0 top-full z-40 mt-1 flex w-64 flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none [&_button]:text-start">
          {children}
        </div>
      )}
    </div>
  )
}
