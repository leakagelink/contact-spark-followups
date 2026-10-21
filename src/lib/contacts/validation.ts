import type { CountryCode } from "libphonenumber-js";
import { isValidEmail, normalizePhone } from "./phone";
import type { ContactDraft, ContactFields } from "./types";

export type IssueCode =
  | "missing_name"
  | "invalid_phone"
  | "landline"
  | "invalid_email"
  | "no_contact_method"
  | "low_confidence"
  | "ambiguous";

export type Issue = { code: IssueCode; field?: string; message: string; blocking: boolean };

export const LOW_CONFIDENCE = 0.6;

/** Normalize phones/emails in place; keeps unparseable values as typed so the user can fix them. */
export function normalizeFields(f: ContactFields, country: CountryCode): ContactFields {
  const out: ContactFields = { ...f };
  for (const k of ["phone", "secondary_phone", "whatsapp_phone"] as const) {
    const info = normalizePhone(out[k], country);
    if (info.valid) out[k] = info.e164;
  }
  for (const k of ["email", "secondary_email"] as const) {
    if (out[k]) out[k] = out[k]!.trim().toLowerCase();
  }
  if (!out.full_name && (out.first_name || out.last_name)) {
    out.full_name = [out.first_name, out.last_name].filter(Boolean).join(" ");
  }
  return out;
}

export function validateFields(
  f: ContactFields,
  country: CountryCode,
  meta?: Pick<ContactDraft, "confidence" | "ambiguous">,
): Issue[] {
  const issues: Issue[] = [];
  if (!f.full_name && !f.first_name && !f.last_name)
    issues.push({ code: "missing_name", field: "full_name", message: "Name missing", blocking: false });
  for (const k of ["phone", "secondary_phone", "whatsapp_phone"] as const) {
    if (!f[k]) continue;
    const info = normalizePhone(f[k], country);
    if (!info.valid)
      issues.push({ code: "invalid_phone", field: k, message: `Invalid or incomplete number: ${f[k]}`, blocking: true });
    else if (k === "phone" && info.type === "landline")
      issues.push({ code: "landline", field: k, message: "Looks like a landline", blocking: false });
  }
  for (const k of ["email", "secondary_email"] as const) {
    if (f[k] && !isValidEmail(f[k]))
      issues.push({ code: "invalid_email", field: k, message: `Invalid email: ${f[k]}`, blocking: true });
  }
  if (!f.phone && !f.email && !f.full_name)
    issues.push({ code: "no_contact_method", message: "No name, phone or email", blocking: true });
  if (meta && meta.confidence < LOW_CONFIDENCE)
    issues.push({ code: "low_confidence", message: "Low-confidence extraction — please check", blocking: false });
  if (meta?.ambiguous.length)
    issues.push({
      code: "ambiguous",
      message: `Check: ${meta.ambiguous.join(", ")}`,
      blocking: false,
    });
  return issues;
}

export function hasBlocking(issues: Issue[]) {
  return issues.some((i) => i.blocking);
}
