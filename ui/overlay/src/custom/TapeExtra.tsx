/*  Loads the extra stays for the tape chart and merges them into what Kamra's chart returned.
    If the extra read fails the chart still draws, as Kamra draws it. */
import { call, getCurrentProperty } from "../lib/api"
import { mergeExtras, type ExtraData, type Extras } from "./tapeExtra"

export async function withExtraStays<T extends ExtraData>(data: T, start: string, days: number): Promise<T> {
  try {
    const extras = await call<Extras>("kamra_custom.tape.extra_stays", {
      property: getCurrentProperty(), start_date: start, days,
    })
    return mergeExtras(data, extras, days)
  } catch {
    return data
  }
}
