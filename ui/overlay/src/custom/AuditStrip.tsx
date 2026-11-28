/*  A strip under the top bar when the night audit is behind (Kamra Custom). Read again at each screen change,
    so it goes away as soon as the audit has run. If the read fails, nothing is shown. */
import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { useT } from "../lib/i18n"
import { auditNotice, showOnPath, type AuditStatus } from "./auditStrip"

export function AuditStrip() {
  const { t } = useT()
  const { pathname } = useLocation()
  const [status, setStatus] = useState<AuditStatus | null>(null)

  useEffect(() => {
    let live = true
    call<AuditStatus>("kamra_custom.attention.audit_status", { property: getCurrentProperty() })
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus(null))
    return () => { live = false }
  }, [pathname])

  const n = auditNotice(status)
  if (!n || !showOnPath(pathname)) return null
  return (
    <div role="status" data-audit-strip
      className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={t(n.text)}>{t(n.text)}</span>
      <Link to="/end-of-day" className="shrink-0 font-medium underline">{t("Open night audit")}</Link>
    </div>
  )
}
