import { describe, expect, it } from "vitest"
import { allLines, rateText, summarise, totalsTie, type PfLine } from "../overlay/src/custom/proforma"

const L = (date: string, code: string, amount: number, rate: number): PfLine => ({ date, code, description: code, amount, tax_rate: rate, tax: amount * rate / 100, total: amount * (1 + rate / 100) })
const lines = [L("2026-12-20", "Room", 1000, 5), L("2026-12-20", "Meal Plan", 200, 5), L("2026-12-21", "Room", 1000, 5), L("2026-12-21", "Meal Plan", 200, 18)]

describe("proforma summary", () => {
  it("none keeps every line", () => expect(summarise(lines, "none")).toHaveLength(4))

  it("by charge adds nights together", () => {
    const s = summarise(lines, "charge")
    expect(s.map((x) => [x.code, x.amount])).toEqual([["Room", 2000], ["Meal Plan", 400]])
  })

  it("by date adds the charges of a night", () => {
    const s = summarise(lines, "date")
    expect(s.map((x) => [x.date, x.amount])).toEqual([["2026-12-20", 1200], ["2026-12-21", 1200]])
  })

  it("by date and charge changes nothing when each pair is single", () => expect(summarise(lines, "date_charge")).toHaveLength(4))

  it("a summed row that mixes tax rates shows no rate", () => {
    const meal = summarise(lines, "charge")[1]
    expect(meal.tax_rate).toBe(-1)
    expect(rateText(meal.tax_rate)).toBe("")
    expect(rateText(5)).toBe("5%")
  })

  it("summing never changes the grand total", () => {
    const total = lines.reduce((s, l) => s + l.total, 0)
    for (const m of ["none", "charge", "date", "date_charge"] as const) expect(totalsTie(summarise(lines, m), total)).toBe(true)
  })

  it("does not change the lines it is given", () => {
    const before = JSON.stringify(lines)
    summarise(lines, "charge")
    expect(JSON.stringify(lines)).toBe(before)
  })

  it("a group adds its rooms' lines together", () => {
    expect(allLines([{ lines: [L("d", "Room", 1, 5)] }, { lines: [L("d", "Room", 2, 5)] }])).toHaveLength(2)
    expect(summarise(allLines([{ lines: [L("d", "Room", 1, 5)] }, { lines: [L("d", "Room", 2, 5)] }]), "charge")[0].amount).toBe(3)
  })
})
