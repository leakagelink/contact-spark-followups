import { supabase } from "@/integrations/supabase/client";
import { mergePreserving } from "./duplicates";
import type { DupAction, ReviewRow } from "./review";
import { CONTACT_FIELDS, type ContactFields, type SourceType } from "./types";

export async function createJob(sourceType: SourceType | "mixed", filename: string | null) {
  const { data, error } = await supabase.from("import_jobs").insert({ source_type: sourceType, source_filename: filename, status: "review" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export type CommitResult = { imported: number; updated: number; skipped: number; failed: number; errors: string[] };

/** Saves the selected rows. Existing contacts are only updated with empty fields (data preserved). */
export async function commitImport(
  jobId: string,
  rows: ReviewRow[],
  actions: Record<string, DupAction>,
  onProgress?: (done: number) => void,
): Promise<CommitResult> {
  const res: CommitResult = { imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  const records: Record<string, unknown>[] = [];
  const toInsert: { row: ReviewRow; payload: Record<string, unknown> }[] = [];

  for (const row of rows) {
    const d = row.draft;
    const action = actions[d.key] ?? (row.dups.some((x) => x.strong) || row.batchDupOf ? "skip" : "create");
    const base = { import_job_id: jobId, extracted_data: d.original as never, confidence: d.confidence, validation_errors: row.issues as never, source_location: d.sourceLocation };
    if (action === "skip") {
      res.skipped++;
      records.push({ ...base, status: "skipped", contact_id: row.dups[0]?.id ?? null });
      continue;
    }
    if (action === "update" && row.dups[0]) {
      const id = row.dups[0].id;
      const { data: cur } = await supabase.from("contacts").select("*").eq("id", id).single();
      const curFields = Object.fromEntries(CONTACT_FIELDS.map((f) => [f, cur?.[f] ?? null])) as ContactFields;
      const merged = mergePreserving(curFields, d.fields);
      const { error } = await supabase.from("contacts").update(merged).eq("id", id);
      if (error) {
        res.failed++;
        res.errors.push(error.message);
        records.push({ ...base, status: "failed", validation_errors: [...row.issues, { message: error.message }] as never });
      } else {
        res.updated++;
        records.push({ ...base, status: "updated", contact_id: id });
      }
      continue;
    }
    toInsert.push({
      row,
      payload: {
        ...d.fields,
        source_filename: d.sourceFilename,
        source_type: d.sourceType,
        source_location: d.sourceLocation,
        import_job_id: jobId,
        extraction_confidence: d.confidence,
        verification_status: row.issues.length ? "needs_review" : "unverified",
      },
    });
  }

  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { data, error } = await supabase.from("contacts").insert(batch.map((b) => b.payload) as never).select("id");
    if (!error && data) {
      res.imported += data.length;
      batch.forEach((b, j) => records.push({ import_job_id: jobId, extracted_data: b.row.draft.original, confidence: b.row.draft.confidence, validation_errors: b.row.issues, source_location: b.row.draft.sourceLocation, status: "imported", contact_id: data[j].id }));
    } else {
      // Fall back to one-by-one so a single conflicting row doesn't fail the whole batch.
      for (const b of batch) {
        const r = await supabase.from("contacts").insert(b.payload as never).select("id").single();
        const base = { import_job_id: jobId, extracted_data: b.row.draft.original, confidence: b.row.draft.confidence, source_location: b.row.draft.sourceLocation };
        if (r.error) {
          res.failed++;
          const msg = r.error.code === "23505" ? "Already exists (same phone or email)" : r.error.message;
          res.errors.push(msg);
          records.push({ ...base, status: r.error.code === "23505" ? "duplicate" : "failed", validation_errors: [...b.row.issues, { message: msg }] });
        } else {
          res.imported++;
          records.push({ ...base, status: "imported", contact_id: r.data.id, validation_errors: b.row.issues });
        }
      }
    }
    onProgress?.(Math.min(i + 200, toInsert.length));
  }

  for (let i = 0; i < records.length; i += 500)
    await supabase.from("import_records").insert(records.slice(i, i + 500) as never);

  await supabase
    .from("import_jobs")
    .update({
      status: "completed",
      total_records: rows.length,
      successful_records: res.imported + res.updated,
      duplicate_records: rows.filter((r) => r.status === "duplicate").length,
      failed_records: res.failed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return res;
}
