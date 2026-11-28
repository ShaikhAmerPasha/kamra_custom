import { showMoment } from "./showDate"

/* WhatsApp link for a confirmation: the number with only its digits, and the message ready to send. */

/** A wa.me link, or "" when the phone has no usable digits. */
export function whatsappUrl(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length < 8) return ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}


/** The documents the desk can send, as the menu names them. */
export const KIND_LABEL: Record<string, string> = {
  confirmation: "Confirmation",
  amended: "Amended confirmation",
  "pre-arrival": "Pre-arrival message",
}

export interface SentRecord {
  when: string
  by: string
  kind: string
  channel: string
  to: string
}

/** "Confirmation sent by WhatsApp on 27 Nov 2026 10:12, by Administrator" for the newest record, or "". */
export function lastSentLine(h: SentRecord | undefined | null): string {
  if (!h) return ""
  const what = KIND_LABEL[h.kind] ?? h.kind
  const how = h.channel === "Download" ? "downloaded" : `sent by ${h.channel}`
  return `${what} ${how} on ${showMoment(h.when)}, by ${h.by}`
}

/** Which document to offer first: the amended one when the booking changed after the last confirmation. */
export function defaultKind(stale: boolean): string {
  return stale ? "amended" : "confirmation"
}

/** A pre-arrival message is text and a link, so it cannot be a PDF. */
export const canDownload = (kind: string): boolean => kind !== "pre-arrival"
