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

import { canDownload, defaultKind, lastSentLine } from "../overlay/src/custom/confirmation"

describe("what was sent", () => {
  it("says what, how, when and by whom", () => {
    expect(lastSentLine({ when: "2026-11-27 10:12:44.5", by: "desk@x", kind: "confirmation", channel: "WhatsApp", to: "+91" }))
      .toBe("Confirmation sent by WhatsApp on 27 Nov 2026 10:12, by desk@x")
    expect(lastSentLine({ when: "2026-11-27 10:12:00", by: "a", kind: "amended", channel: "Download", to: "" }))
      .toBe("Amended confirmation downloaded on 27 Nov 2026 10:12, by a")
  })
  it("is empty when nothing was sent", () => {
    expect(lastSentLine(undefined)).toBe("")
    expect(lastSentLine(null)).toBe("")
  })
  it("offers the amended document when the booking changed", () => {
    expect(defaultKind(true)).toBe("amended")
    expect(defaultKind(false)).toBe("confirmation")
  })
  it("cannot download a pre-arrival message", () => {
    expect(canDownload("pre-arrival")).toBe(false)
    expect(canDownload("amended")).toBe(true)
  })
})
