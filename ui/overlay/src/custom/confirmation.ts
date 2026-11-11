/* WhatsApp link for a confirmation: the number with only its digits, and the message ready to send. */

/** A wa.me link, or "" when the phone has no usable digits. */
export function whatsappUrl(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length < 8) return ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
