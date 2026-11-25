/*  The billing and analysis fields (Kamra Custom), as MyCloud's Billing and Analysis codes blocks:
    label-left rows. Used on a new booking and on an open stay. */

import { PAY_BY, type Billing } from "./billing"

// no "grid" class: the dense desk page turns every .grid into one column, and the labels would sit above
const row = "kd-row items-center"
const rowStyle = { display: "grid", gridTemplateColumns: "130px minmax(0, 1fr)", columnGap: "8px" } as const
const lab = "kd-lab text-right text-sm text-zinc-600"
const input = "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm"

export function BillingFields(props: { value: Billing; onChange: (patch: Partial<Billing>) => void; disabled?: boolean; idPrefix?: string }) {
  const { value: v, onChange, disabled } = props
  const id = (n: string) => `${props.idPrefix ?? "billing"}-${n}`
  return (
    <div className="space-y-2">
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("pay-by")}>Pay by</label>
        <select id={id("pay-by")} className={input} disabled={disabled} value={v.pay_by} onChange={(e) => onChange({ pay_by: e.target.value })}>
          <option value="" />
          {PAY_BY.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("gst")}>GST number</label>
        <input id={id("gst")} className={input} maxLength={15} disabled={disabled} value={v.gst_number} onChange={(e) => onChange({ gst_number: e.target.value.toUpperCase() })} />
      </div>
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("pan")}>PAN number</label>
        <input id={id("pan")} className={input} maxLength={10} disabled={disabled} value={v.pan_number} onChange={(e) => onChange({ pan_number: e.target.value.toUpperCase() })} />
      </div>
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("limit")}>Credit limit</label>
        <input id={id("limit")} className={input} inputMode="decimal" disabled={disabled} value={v.credit_limit} onChange={(e) => onChange({ credit_limit: e.target.value })} />
      </div>
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("source")}>Business source</label>
        <input id={id("source")} className={input} disabled={disabled} value={v.business_source} onChange={(e) => onChange({ business_source: e.target.value })} />
      </div>
      <div className={row} style={rowStyle}>
        <label className={lab} htmlFor={id("domicile")}>Domicile</label>
        <input id={id("domicile")} className={input} disabled={disabled} value={v.domicile} onChange={(e) => onChange({ domicile: e.target.value })} placeholder="Country" />
      </div>
      <div className={row} style={rowStyle}>
        <span className={lab} />
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={v.guaranteed} onChange={(e) => onChange({ guaranteed: e.target.checked })} />Guaranteed</label>
          <label className="flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={v.tax_exempt} onChange={(e) => onChange({ tax_exempt: e.target.checked })} />Tax exempt</label>
          <label className="flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={v.special_guest} onChange={(e) => onChange({ special_guest: e.target.checked })} />Special guest</label>
        </span>
      </div>
    </div>
  )
}
