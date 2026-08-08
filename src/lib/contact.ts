export type PreferredChannel = "whatsapp" | "email";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidInternationalPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function validateContact(email: string, phone: string): string | null {
  const cleanEmail = email.trim();
  const cleanPhone = phone.trim();
  if (!cleanEmail && !cleanPhone) return "Add an email address or a WhatsApp number so we can contact this lead.";
  if (cleanEmail && !isValidEmail(cleanEmail)) return "Enter a valid email address.";
  if (cleanPhone && !isValidInternationalPhone(cleanPhone)) return "Enter a valid WhatsApp number with country code, for example +91 98765 43210.";
  return null;
}

export function defaultPreferredChannel(email: string, phone: string): PreferredChannel {
  return phone.trim() ? "whatsapp" : "email";
}
