/*  The printed bill with the meal inside the room line (Kamra Custom). The folio screen keeps
    its own table, with the void and move buttons, on screen; this one is only for paper. */

import { fmtMoney } from "../lib/money"
import { useT } from "../lib/i18n"
import { mergeMealIntoRoom, type BillCharge } from "./billLines"

export function PrintBillLines({ charges }: { charges: BillCharge[] }) {
  const { t } = useT()
  const lines = mergeMealIntoRoom(charges)
  return (
    <table className="mb-5 hidden w-full text-sm print:table">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
          <th className="py-2 pr-3">{t("Date")}</th>
          <th className="py-2 pr-3">{t("Item")}</th>
          <th className="py-2 pr-3 text-right">{t("Amount")}</th>
          <th className="py-2 pr-3 text-right">%</th>
          <th className="py-2 pr-3 text-right">{t("Tax")}</th>
          <th className="py-2 text-right">{t("Total")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {lines.map((l) => (
          <tr key={l.key}>
            <td className="py-2 pr-3 text-zinc-500">{l.date}</td>
            <td className="py-2 pr-3">{l.item}</td>
            <td className="py-2 pr-3 text-right">{fmtMoney(l.amount)}</td>
            <td className="py-2 pr-3 text-right">{l.gst_rate === null ? t("mixed") : `${l.gst_rate}%`}</td>
            <td className="py-2 pr-3 text-right">{fmtMoney(l.gst_amount)}</td>
            <td className="py-2 text-right font-medium">{fmtMoney(l.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
