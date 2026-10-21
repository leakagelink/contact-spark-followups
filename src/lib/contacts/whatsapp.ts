import { formatPhone, normalizePhone } from "./phone";
import { FIELD_LABELS, type ContactField, type ContactFields } from "./types";

export const DEFAULT_TEMPLATE =
  "Hello {{name}}, this is a follow-up regarding our recent call. Please let me know a convenient time to connect. Thank you.";

export function renderTemplate(tpl: string, c: ContactFields): string {
  const first = c.first_name || (c.full_name ?? "").split(" ")[0] || "";
  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, c.full_name || first || "there")
    .replace(/\{\{\s*first_name\s*\}\}/g, first || "there")
    .replace(/\{\{\s*phone\s*\}\}/g, formatPhone(c.phone) || "")
    .replace(/\{\{\s*company\s*\}\}/g, c.company || "")
    .replace(/\{\{\s*email\s*\}\}/g, c.email || "");
}

/** wa.me Click-to-Chat URL. Returns null when the number is not a valid international number. */
export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const info = normalizePhone(phone);
  if (!info.valid || !info.e164) return null;
  const digits = info.e164.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Which number to message: explicit WhatsApp number first, then primary mobile. */
export function waNumber(c: ContactFields): string | null {
  return c.whatsapp_phone || c.phone || null;
}

export const SHAREABLE_FIELDS: ContactField[] = [
  "full_name",
  "phone",
  "secondary_phone",
  "email",
  "company",
  "job_title",
  "address",
  "city",
  "state",
  "website",
];

export function shareDetailsText(c: ContactFields, fields: ContactField[]): string {
  return fields
    .filter((f) => c[f])
    .map((f) => {
      const v = f.includes("phone") ? formatPhone(c[f]) : c[f];
      const label = f === "full_name" ? "Name" : f === "phone" ? "Phone" : FIELD_LABELS[f];
      return `${label}: ${v}`;
    })
    .join("\n");
}
