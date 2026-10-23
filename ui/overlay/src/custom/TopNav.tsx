/*  Horizontal top navigation (Kamra Custom).
    One menu per app the user may open, in Kamra's own order, built from the same
    `apps` the sidebar used, so role and module rules do not change. An app's
    pages drop down under it, grouped the way the sidebar grouped them. */

import { useEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { ChevronDown, Menu as MenuIcon, X } from "lucide-react"
import { appForPath, type AppDef, type AppNavItem } from "../lib/apps"
import { useT } from "../lib/i18n"
import { asset } from "../lib/asset"
import { cn } from "../lib/utils"

/** Patched into AppShell: the sidebar steps aside while this is on. */
export const CUSTOM_NAV = true

function visibleItems(app: AppDef, roles: string[]): AppNavItem[] {
  return app.items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)))
}

function grouped(items: AppNavItem[]): { group?: string; items: AppNavItem[] }[] {
  const out: { group?: string; items: AppNavItem[] }[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else out.push({ group: item.group, items: [item] })
  }
  return out
}

function Item({ item, onPick }: { item: AppNavItem; onPick: () => void }) {
  const { t } = useT()
  const cls = "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
  const body = (
    <>
      <item.icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
      <span className="truncate">{t(item.label)}</span>
    </>
  )
  if (item.href)
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={cls} role="menuitem" onClick={onPick}>
        {body}
      </a>
    )
  return (
    <NavLink
      to={item.to!}
      end={item.to === "/"}
      role="menuitem"
      onClick={onPick}
      className={({ isActive }) => cn(cls, isActive && "bg-brand-50 text-brand-700")}
    >
      {body}
    </NavLink>
  )
}

function Panel({ app, roles, onPick }: { app: AppDef; roles: string[]; onPick: () => void }) {
  const { t } = useT()
  return (
    <div role="menu" aria-label={t(app.name)} className="min-w-52 p-1">
      {grouped(visibleItems(app, roles)).map((g, i) => (
        <div key={i} className={i ? "mt-1 border-t border-zinc-100 pt-1" : ""}>
          {g.group ? (
            <div className="px-3 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              {t(g.group)}
            </div>
          ) : null}
          {g.items.map((item) => (
            <Item key={(item.to ?? item.href) + item.label} item={item} onPick={onPick} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function TopNav({ apps, roles }: { apps: AppDef[]; roles: string[] }) {
  const { t } = useT()
  const { pathname } = useLocation()
  const current = appForPath(pathname).id
  const [open, setOpen] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const bar = useRef<HTMLElement>(null)

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null)
        setDrawer(false)
      }
    }
    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [])

  const close = () => {
    setOpen(null)
    setDrawer(false)
  }

  return (
    <nav ref={bar} aria-label={t("Main")} className="relative z-30 border-b border-zinc-200 bg-zinc-50 print:hidden">
      <div className="flex items-stretch gap-1 px-3">
        <NavLink to="/" className="mr-2 flex items-center gap-2 pr-2" onClick={close}>
          <img src={asset("kamra-mark.svg")} alt="" className="size-6" aria-hidden />
          <span className="text-base font-semibold tracking-tight">kamra</span>
        </NavLink>

        <ul className="hidden items-stretch md:flex">
          {apps.map((app) => (
            <li key={app.id} className="relative" onMouseLeave={() => setOpen((o) => (o === app.id ? null : o))}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open === app.id}
                onClick={() => setOpen(open === app.id ? null : app.id)}
                onMouseEnter={() => open && setOpen(app.id)}
                className={cn(
                  "flex h-10 items-center gap-1 px-3 text-sm font-medium",
                  open === app.id
                    ? "bg-white text-zinc-900"
                    : current === app.id
                      ? "text-brand-700"
                      : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                {t(app.name)}
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
              {open === app.id ? (
                <div className="absolute left-0 top-full z-50 rounded-b-md border border-t-0 border-zinc-200 bg-white shadow-lg">
                  <Panel app={app} roles={roles} onPick={close} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          aria-label={drawer ? t("Close menu") : t("Open menu")}
          aria-expanded={drawer}
          onClick={() => setDrawer(!drawer)}
          className="ml-auto flex h-10 items-center gap-2 text-sm font-medium text-zinc-700 md:hidden"
        >
          {drawer ? <X className="size-4" /> : <MenuIcon className="size-4" />} {t("Menu")}
        </button>
      </div>

      {drawer ? (
        <div className="max-h-[70vh] overflow-y-auto border-t border-zinc-200 bg-white md:hidden">
          {apps.map((app) => (
            <details key={app.id} className="border-b border-zinc-100" open={app.id === current}>
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">{t(app.name)}</summary>
              <Panel app={app} roles={roles} onPick={close} />
            </details>
          ))}
        </div>
      ) : null}
    </nav>
  )
}
