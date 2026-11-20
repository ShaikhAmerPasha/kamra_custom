/*  What the desk should see before it checks a guest in or out (Kamra Custom): a short list of
    what is settled and what is not. Pure: the dialog passes what Kamra already returned. */

export interface CheckItem {
  key: "bill" | "folios" | "id" | "deposit" | "balance"
  ok: boolean
  /** A figure to show beside the label, in the dialog's currency. */
  amount?: number
  count?: number
}

const EPS = 0.005

export function checkOutItems(i: {
  due: number
  folios: { side: string; status: string; has_charges: boolean; balance: number }[]
  idMissing: boolean
}): CheckItem[] {
  const open = i.folios.filter(
    (f) => f.side !== "group" && f.status === "Open" && f.has_charges && Math.abs(f.balance) > EPS,
  ).length
  // the guest's own bill is the "bill" item; this one is for the extra bills (company, split)
  const items: CheckItem[] = [{ key: "bill", ok: i.due <= EPS, amount: Math.max(0, i.due) }]
  if (open > 1) items.push({ key: "folios", ok: false, count: open })
  items.push({ key: "id", ok: !i.idMissing })
  return items
}

/** `othersMissing`: how many other adults still have no ID. When the guest's own ID is on file and
    only they are missing, the line says so instead of "No ID on file". */
export function checkInItems(i: { due: number; paid: number; idMissing: boolean; ownIdOnFile?: boolean; othersMissing?: number }): CheckItem[] {
  const others = i.idMissing && i.ownIdOnFile ? Math.max(0, i.othersMissing ?? 0) : 0
  return [
    { key: "balance", ok: i.due <= EPS, amount: Math.max(0, i.due) },
    { key: "deposit", ok: i.paid > EPS, amount: Math.max(0, i.paid) },
    { key: "id", ok: !i.idMissing, ...(others > 0 ? { count: others } : {}) },
  ]
}
