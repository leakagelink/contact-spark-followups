import type { CountryCode } from "libphonenumber-js";
import { findDuplicates, type DupMatch } from "./duplicates";
import { hasBlocking, validateFields, type Issue } from "./validation";
import type { ContactDraft, ContactFields } from "./types";

export type DupAction = "skip" | "update" | "create";
export type ReviewRow = {
  draft: ContactDraft;
  issues: Issue[];
  dups: DupMatch[];
  /** key of an earlier draft in this same batch with the same phone/email */
  batchDupOf: string | null;
  status: "valid" | "review" | "duplicate" | "invalid";
};

export function analyze(drafts: ContactDraft[], existing: ({ id: string } & ContactFields)[], country: CountryCode): ReviewRow[] {
  const seen = new Map<string, string>();
  return drafts.map((d) => {
    const issues = validateFields(d.fields, country, d);
    const dups = findDuplicates(d.fields, existing);
    let batchDupOf: string | null = null;
    for (const k of [d.fields.phone, d.fields.email?.toLowerCase()].filter(Boolean) as string[]) {
      if (seen.has(k)) batchDupOf = seen.get(k)!;
      else seen.set(k, d.key);
    }
    const status: ReviewRow["status"] = hasBlocking(issues)
      ? "invalid"
      : dups.some((x) => x.strong) || batchDupOf
        ? "duplicate"
        : issues.length || dups.length
          ? "review"
          : "valid";
    return { draft: d, issues, dups, batchDupOf, status };
  });
}

export function summarize(rows: ReviewRow[]) {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    review: rows.filter((r) => r.status === "review").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
  };
}
