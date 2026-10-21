import type { CountryCode } from "libphonenumber-js";
import { digitsOnly, findEmails, findPhones, normalizePhone } from "./phone";
import { normalizeFields } from "./validation";
import { CONTACT_FIELDS, emptyToNull, type ContactDraft, type ContactField, type ContactFields, type SourceType } from "./types";

let seq = 0;
export const newKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

type AiRecord = Partial<Record<ContactField, string | null>> & {
  source_location?: string | null;
  confidence?: number;
  ambiguous_fields?: string[];
};

/**
 * Turn AI output into drafts. When the source text is available, phones/emails the AI returned that do
 * not appear in the text are dropped (anti-hallucination), and numbers/emails the AI missed are added
 * back as partial contacts flagged for review.
 */
export function draftsFromAI(
  records: AiRecord[],
  opts: { sourceText?: string; country: CountryCode; sourceFilename: string | null; sourceType: SourceType; defaultLocation?: string | null },
): ContactDraft[] {
  const srcDigits = opts.sourceText ? digitsOnly(opts.sourceText) : null;
  const srcLower = opts.sourceText?.toLowerCase() ?? null;
  const drafts: ContactDraft[] = records.map((r) => {
    const original: ContactFields = {};
    for (const f of CONTACT_FIELDS) original[f] = emptyToNull(r[f]);
    const fields = { ...original };
    const ambiguous = new Set((r.ambiguous_fields ?? []).filter((f): f is ContactField => (CONTACT_FIELDS as readonly string[]).includes(f)));
    if (srcDigits) {
      for (const k of ["phone", "secondary_phone", "whatsapp_phone"] as const) {
        const d = fields[k] ? digitsOnly(fields[k]!) : "";
        if (d && !srcDigits.includes(d.slice(-8))) {
          fields[k] = null;
          ambiguous.add(k);
        }
      }
    }
    if (srcLower) {
      for (const k of ["email", "secondary_email"] as const) {
        if (fields[k] && !srcLower.includes(fields[k]!.toLowerCase())) {
          fields[k] = null;
          ambiguous.add(k);
        }
      }
    }
    return {
      key: newKey(),
      fields: normalizeFields(fields, opts.country),
      original,
      confidence: Math.max(0, Math.min(1, r.confidence ?? 0.5)),
      ambiguous: [...ambiguous],
      sourceFilename: opts.sourceFilename,
      sourceType: opts.sourceType,
      sourceLocation: emptyToNull(r.source_location) ?? opts.defaultLocation ?? null,
    };
  });

  if (opts.sourceText) {
    const seenPhones = new Set(drafts.flatMap((d) => [d.fields.phone, d.fields.secondary_phone, d.fields.whatsapp_phone]).filter(Boolean));
    const seenEmails = new Set(drafts.flatMap((d) => [d.fields.email, d.fields.secondary_email]).filter(Boolean));
    for (const p of findPhones(opts.sourceText, opts.country)) {
      if (!seenPhones.has(p)) drafts.push(partial({ phone: p }, opts));
    }
    for (const e of findEmails(opts.sourceText)) {
      if (!seenEmails.has(e)) drafts.push(partial({ email: e }, opts));
    }
  }
  return drafts;
}

function partial(f: ContactFields, opts: { sourceFilename: string | null; sourceType: SourceType; defaultLocation?: string | null }): ContactDraft {
  return {
    key: newKey(),
    fields: f,
    original: f,
    confidence: 0.4,
    ambiguous: [],
    sourceFilename: opts.sourceFilename,
    sourceType: opts.sourceType,
    sourceLocation: opts.defaultLocation ?? null,
  };
}

/** Deterministic row → draft for spreadsheets (no AI needed when columns are mapped). */
export function draftFromRow(
  row: string[],
  mapping: (ContactField | null)[],
  opts: { country: CountryCode; sourceFilename: string; sourceType: SourceType; location: string },
): ContactDraft | null {
  const f: ContactFields = {};
  mapping.forEach((m, i) => {
    if (!m) return;
    const v = emptyToNull(row[i]);
    if (v) f[m] = f[m] ? `${f[m]} ${v}` : v;
  });
  if (!Object.values(f).some(Boolean)) return null;
  // A cell may hold two numbers like "98765 43210 / 91234 56780"
  if (f.phone && !normalizePhone(f.phone, opts.country).valid) {
    const found = findPhones(f.phone, opts.country);
    if (found.length) {
      f.phone = found[0];
      if (found[1] && !f.secondary_phone) f.secondary_phone = found[1];
    }
  }
  return {
    key: newKey(),
    fields: normalizeFields(f, opts.country),
    original: f,
    confidence: 1,
    ambiguous: [],
    sourceFilename: opts.sourceFilename,
    sourceType: opts.sourceType,
    sourceLocation: opts.location,
  };
}
