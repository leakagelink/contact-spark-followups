import type { ContactFields } from "./types";

export type DupMatch = { id: string; reason: "phone" | "email" | "name"; strong: boolean };

type Existing = { id: string } & ContactFields;

const normName = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z\u0900-\u097f]/g, "");

/**
 * Phone and email are strong identity signals; matching names only are a weak "potential duplicate".
 * Never auto-merge on weak matches.
 */
export function findDuplicates(draft: ContactFields, existing: Existing[]): DupMatch[] {
  const phones = [draft.phone, draft.secondary_phone, draft.whatsapp_phone].filter(Boolean) as string[];
  const emails = [draft.email, draft.secondary_email].filter(Boolean).map((e) => e!.toLowerCase());
  const name = normName(draft.full_name);
  const out: DupMatch[] = [];
  for (const c of existing) {
    const cPhones = [c.phone, c.secondary_phone, c.whatsapp_phone].filter(Boolean);
    const cEmails = [c.email, c.secondary_email].filter(Boolean).map((e) => e!.toLowerCase());
    if (phones.some((p) => cPhones.includes(p))) out.push({ id: c.id, reason: "phone", strong: true });
    else if (emails.some((e) => cEmails.includes(e))) out.push({ id: c.id, reason: "email", strong: true });
    else if (name.length > 3 && normName(c.full_name) === name) out.push({ id: c.id, reason: "name", strong: false });
  }
  return out;
}

/** Fill only empty fields of `base` from `incoming` — existing data is preserved. */
export function mergePreserving(base: ContactFields, incoming: ContactFields): ContactFields {
  const out: ContactFields = { ...base };
  for (const [k, v] of Object.entries(incoming) as [keyof ContactFields, string | null][]) {
    if (v && !out[k]) out[k] = v;
  }
  if (incoming.notes && base.notes && !base.notes.includes(incoming.notes)) {
    out.notes = `${base.notes}\n${incoming.notes}`;
  }
  return out;
}
