import { describe, expect, it } from "vitest"
import { whatsappUrl } from "../overlay/src/custom/confirmation"

describe("whatsappUrl", () => {
  it("keeps only the digits of the number", () => {
    expect(whatsappUrl("+91 98450-12345", "Hi")).toBe("https://wa.me/919845012345?text=Hi")
  })
  it("encodes the message", () => {
    expect(whatsappUrl("919845012345", "Dear Rahul,\nTotal: ₹3,150")).toContain("text=Dear%20Rahul%2C%0ATotal%3A%20%E2%82%B93%2C150")
  })
  it("gives nothing for a missing or short number", () => {
    expect(whatsappUrl("", "Hi")).toBe("")
    expect(whatsappUrl(null, "Hi")).toBe("")
    expect(whatsappUrl("12345", "Hi")).toBe("")
  })
})
