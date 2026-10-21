import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type PhoneInfo = {
  e164: string | null;
  valid: boolean;
  type: "mobile" | "landline" | "unknown";
  display: string | null;
};

/** Country-aware phone normalization. Returns e164 only for numbers that parse as valid. */
export function normalizePhone(raw: string | null | undefined, country: CountryCode = "IN"): PhoneInfo {
  if (!raw) return { e164: null, valid: false, type: "unknown", display: null };
  let s = String(raw).trim();
  // Spreadsheets sometimes turn numbers into floats like 9876543210.0
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  if (/^00\d/.test(s)) s = "+" + s.slice(2);
  const p = parsePhoneNumberFromString(s, country);
  if (!p || !p.isValid()) return { e164: null, valid: false, type: "unknown", display: s };
  const t = p.getType();
  const type =
    t === "MOBILE" ? "mobile" : t === "FIXED_LINE" ? "landline" : t === "FIXED_LINE_OR_MOBILE" ? "unknown" : "unknown";
  return { e164: p.number, valid: true, type, display: p.formatInternational() };
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const p = parsePhoneNumberFromString(e164);
  return p ? p.formatInternational() : e164;
}

/** Find phone-like substrings in free text (deterministic, no AI). */
export function findPhones(text: string, country: CountryCode = "IN"): string[] {
  const out = new Set<string>();
  const re = /(?:\+|00)?\d[\d\s().-]{7,18}\d/g;
  for (const m of text.match(re) ?? []) {
    const info = normalizePhone(m, country);
    if (info.valid && info.e164) out.add(info.e164);
  }
  return [...out];
}

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function findEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

export function isValidEmail(e: string | null | undefined): boolean {
  if (!e) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e.trim());
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}
