/*  Horizontal top navigation (Kamra Custom).
    Displays the current app's navigation items horizontally across the top bar.
    App switching (Front Desk, Housekeeping, Operations, F&B, etc.) is handled
    by the 9-dot AppSwitcher in the header. */

import { Fragment, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { appForPath, type AppDef, type AppNavItem } from "../lib/apps"
import { useT } from "../lib/i18n"
import { asset } from "../lib/asset"
import { cn } from "../lib/utils"
import { AuditStrip } from "./AuditStrip"

/** Patched into AppShell: the sidebar steps aside while this is on. */
export const CUSTOM_NAV = true

function visibleItems(app: AppDef, roles: string[]): AppNavItem[] {
  return (app?.items ?? [])
    .filter((i) => i.to !== "/reservation-search")
    .filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)))
}

function Item({ item, appId }: { item: AppNavItem; appId: string }) {
  const { t } = useT()
  const cls = cn(
    "group flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs lg:text-[13px] font-medium transition-colors shrink-0",
    item.featured
      ? "border border-brand-200/80 bg-gradient-to-r from-brand-50 to-white text-brand-800 hover:border-brand-300 hover:from-brand-100"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  )

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={cls}
        title={t(item.label)}
      >
        <item.icon className="size-4 shrink-0 text-zinc-400 group-hover:text-zinc-600" aria-hidden />
        <span>{t(item.label)}</span>
      </a>
    )
  }

  return (
    <NavLink
      to={item.to!}
      state={{ app: appId }}
      end={item.to === "/"}
      title={t(item.label)}
      className={({ isActive }) =>
        cn(
          cls,
          isActive &&
            (item.featured
              ? "border-brand-700 bg-brand-600 text-white shadow-sm"
              : "bg-brand-50 text-brand-700 font-semibold"),
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              "size-4 shrink-0 transition-colors",
              isActive
                ? item.featured
                  ? "text-white"
                  : "text-brand-600"
                : item.featured
                  ? "text-brand-600"
                  : "text-zinc-400 group-hover:text-zinc-600",
            )}
            aria-hidden
          />
          <span>{t(item.label)}</span>
          {item.featured && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider",
                isActive ? "bg-white/20 text-white" : "bg-brand-100 text-brand-700",
              )}
            >
              {t("AI")}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function TopNav({
  apps,
  roles,
  currentApp: currentAppProp,
}: {
  apps: AppDef[]
  roles: string[]
  currentApp?: AppDef
}) {
  const { t } = useT()
  const location = useLocation()
  const bar = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeApp =
    currentAppProp ??
    (() => {
      let last: string | undefined
      try {
        last = sessionStorage.getItem("kamra:app") ?? undefined
      } catch {
        last = undefined
      }
      const stateApp = (location.state as { app?: string } | null)?.app ?? last
      return appForPath(location.pathname, apps, stateApp)
    })()

  const app = apps.find((a) => a.id === activeApp.id) ?? activeApp ?? apps[0]
  const items = visibleItems(app, roles)

  const onWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && e.deltaY && !e.deltaX) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }

  return (
    <nav
      ref={bar}
      data-topnav
      aria-label={t("Navigation")}
      className="relative z-30 border-b border-zinc-200 bg-zinc-50 print:hidden"
    >
      <div className="flex items-center gap-1 px-3 h-10">
        <NavLink
          to="/"
          state={{ app: "front-desk" }}
          className="mr-2 flex items-center gap-1.5 pr-2.5 border-r border-zinc-200 shrink-0 text-zinc-700 hover:text-zinc-900"
          title={t("Home")}
        >
          <img src={asset("kamra-mark.svg")} alt="" className="size-5 shrink-0" aria-hidden />
          <span className="text-sm font-semibold tracking-tight hidden sm:inline">kamra</span>
        </NavLink>

        <div
          ref={scrollRef}
          onWheel={onWheel}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, idx) => {
            const prev = items[idx - 1]
            const showGroupDivider = prev && item.group && prev.group !== item.group
            return (
              <Fragment key={(item.to ?? item.href ?? "") + item.label}>
                {showGroupDivider && (
                  <div
                    className="mx-1.5 h-4 w-px bg-zinc-200 shrink-0"
                    aria-hidden
                  />
                )}
                <Item item={item} appId={app.id} />
              </Fragment>
            )
          })}
        </div>
      </div>
      <AuditStrip />
    </nav>
  )
}
