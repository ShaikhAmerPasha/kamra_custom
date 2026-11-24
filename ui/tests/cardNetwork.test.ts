import { describe, expect, it } from "vitest"
import { CARD_NETWORKS, cardArgs, cardProblem, isCard } from "../overlay/src/custom/cardNetwork"

describe("card network", () => {
  it("only the Card mode is split by network", () => {
    expect(isCard("Card")).toBe(true)
    expect(isCard("UPI")).toBe(false)
    expect(isCard("Cash")).toBe(false)
  })
  it("offers the networks the desk uses, RuPay included", () => {
    expect(CARD_NETWORKS).toContain("RuPay")
    expect(CARD_NETWORKS).toContain("American Express")
  })
  it("asks for a network on a card, never on another mode", () => {
    expect(cardProblem("Card")).toMatch(/card type/)
    expect(cardProblem("UPI")).toBe("")
    expect(cardProblem("Card", "Visa")).toBe("")
  })
  it("accepts exactly four digits or none", () => {
    expect(cardProblem("Card", "Visa", "1234")).toBe("")
    expect(cardProblem("Card", "Visa", "")).toBe("")
    expect(cardProblem("Card", "Visa", "12")).toMatch(/4 digits/)
    expect(cardProblem("Card", "Visa", "12ab")).toMatch(/4 digits/)
  })
  it("sends the network, and the last 4 only when given", () => {
    expect(cardArgs("Card", "Visa", "1234")).toEqual({ card_network: "Visa", card_last4: "1234" })
    expect(cardArgs("Card", "Visa")).toEqual({ card_network: "Visa" })
    expect(cardArgs("UPI", "Visa", "1234")).toEqual({})
  })
})
