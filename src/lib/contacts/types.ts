export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || "ContactFlow AI";

export const CONTACT_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "secondary_phone",
  "whatsapp_phone",
  "email",
  "secondary_email",
  "address",
  "city",
  "state",
  "country",
  "postal_code",
  "company",
  "job_title",
  "website",
  "notes",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

export const FIELD_LABELS: Record<ContactField, string> = {
  full_name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  phone: "Mobile",
  secondary_phone: "Secondary phone",
  whatsapp_phone: "WhatsApp",
  email: "Email",
  secondary_email: "Secondary email",
  address: "Address",
  city: "City",
  state: "State",
  country: "Country",
  postal_code: "Postal code",
  company: "Company",
  job_title: "Job title",
  website: "Website",
  notes: "Notes",
};

export type ContactFields = Partial<Record<ContactField, string | null>>;

export type SourceType = "image" | "pdf" | "excel" | "csv" | "word" | "text" | "scan" | "manual";

/** A contact detected during import, before it is saved. */
export type ContactDraft = {
  key: string;
  fields: ContactFields;
  /** Values exactly as extracted, before normalization. */
  original: ContactFields;
  confidence: number; // 0..1
  ambiguous: ContactField[];
  sourceFilename: string | null;
  sourceType: SourceType;
  sourceLocation: string | null;
};

export type Contact = {
  id: string;
  user_id: string;
  tags: string[];
  source_filename: string | null;
  source_type: string | null;
  source_location: string | null;
  verification_status: string;
  follow_up_status: string;
  follow_up_at: string | null;
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
} & Record<ContactField, string | null>;

export function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function displayName(c: ContactFields): string {
  return (
    c.full_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    c.company ||
    c.email ||
    c.phone ||
    "Unnamed contact"
  );
}
