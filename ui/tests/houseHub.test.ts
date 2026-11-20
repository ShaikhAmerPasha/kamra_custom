import { describe, expect, it } from "vitest"
import { attentionLink, behindNotice, changeText, changeTone, formatCell, periodRows, roomLines, type Period } from "../overlay/src/custom/houseHub"

const fig = (o: Partial<Period["this"]> = {}) => ({ rooms_sold: 4, occupancy_pct: 13.3, room_revenue: 10000, total_revenue: 12000, adr: 2500, revpar: 333, ...o })
const period = (this_: Partial<Period["this"]>, last: Partial<Period["this"]>): Period => ({
  from: "2026-11-01", to: "2026-11-12", this: fig(this_), last: fig(last),
  change_pct: { rooms_sold: 10, occupancy_pct: 5, room_revenue: -20, total_revenue: 3, adr: null, revpar: 0 },
})
const periods = { today: period({}, {}), mtd: period({ room_revenue: 226000, total_revenue: 263700 }, {}), ytd: period({}, {}) }

describe("periodRows", () => {
  const rows = periodRows(periods)
  it("lists the rows in a fixed order", () => {
    expect(rows.map((r) => r.key)).toEqual(["rooms_sold", "occupancy", "room_revenue", "other_revenue", "total_revenue", "adr", "revpar"])
  })
  it("has a cell for today, month and year", () => expect(rows.every((r) => r.cells.length === 3)).toBe(true))
  it("takes Kamra's own change against last year", () => {
    expect(rows.find((r) => r.key === "room_revenue")!.cells[0].change).toBe(-20)
    expect(rows.find((r) => r.key === "adr")!.cells[0].change).toBeNull()
  })
  it("works out food and other revenue as total less rooms", () => {
    expect(rows.find((r) => r.key === "other_revenue")!.cells[1].value).toBe(37700)
  })
  it("never shows a negative figure for other revenue", () => {
    const odd = periodRows({ today: period({ room_revenue: 5000, total_revenue: 4000 }, {}), mtd: periods.mtd, ytd: periods.ytd })
    expect(odd.find((r) => r.key === "other_revenue")!.cells[0].value).toBe(0)
  })
  it("compares other revenue with last year itself", () => {
    const r = periodRows({ today: period({ room_revenue: 1000, total_revenue: 2000 }, { room_revenue: 1000, total_revenue: 1500 }), mtd: periods.mtd, ytd: periods.ytd })
    expect(r.find((x) => x.key === "other_revenue")!.cells[0].change).toBe(100)
  })
  it("has no comparison when last year had none", () => {
    const r = periodRows({ today: period({ room_revenue: 1000, total_revenue: 2000 }, { room_revenue: 1000, total_revenue: 1000 }), mtd: periods.mtd, ytd: periods.ytd })
    expect(r.find((x) => x.key === "other_revenue")!.cells[0].change).toBeNull()
  })
})

describe("text helpers", () => {
  it("signs a rise", () => expect(changeText(12)).toBe("+12%"))
  it("keeps a fall's sign", () => expect(changeText(-3.5)).toBe("-3.5%"))
  it("is empty without a comparison", () => {
    expect(changeText(null)).toBe("")
    expect(changeText(undefined)).toBe("")
  })
  it("colours by direction", () => {
    expect(changeTone(5)).toContain("emerald")
    expect(changeTone(-5)).toContain("rose")
    expect(changeTone(null)).toContain("zinc")
  })
  it("formats by kind", () => {
    const money = (n: number) => `₹${n}`
    expect(formatCell("money", 2500, money)).toBe("₹2500")
    expect(formatCell("pct", 13.333, money)).toBe("13.3%")
    expect(formatCell("count", 1940, money)).toBe("1,940")
  })
})

describe("behindNotice", () => {
  it("is quiet when the audit is up to date", () => expect(behindNotice(0)).toBeNull())
  it("says how many days", () => expect(behindNotice(8)?.vars).toEqual({ n: 8 }))
  it("uses the singular for one day", () => expect(behindNotice(1)?.key).toContain("{n} day behind"))
})

describe("links and rooms", () => {
  it("sends arrival problems to arrivals", () => expect(attentionLink("no_room")).toBe("/in-house?tab=arrivals"))
  it("sends audit to the night audit", () => expect(attentionLink("audit_behind")).toBe("/end-of-day"))
  it("sends stay problems to in house", () => expect(attentionLink("owing")).toBe("/in-house?tab=in-house"))
  it("lists the worst rooms first", () => {
    expect(roomLines({ total: 30, clean: 24, dirty: 3, inspected: 2, out_of_order: 1 }).map((l) => l.key)).toEqual(["out_of_order", "dirty", "clean", "inspected"])
  })
})
