import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactForm } from "@/components/contacts/ContactForm";
import { getProfile, fetchIdentityIndex } from "@/lib/contacts/db";
import { analyze, summarize, type DupAction } from "@/lib/contacts/review";
import { commitImport, createJob, type CommitResult } from "@/lib/contacts/commit";
import { draftFromRow } from "@/lib/contacts/postprocess";
import { normalizeFields } from "@/lib/contacts/validation";
import { formatPhone } from "@/lib/contacts/phone";
import { yieldToUI } from "@/lib/contacts/file-processing";
import { displayName, type ContactDraft } from "@/lib/contacts/types";
import { useImportPipeline, type SheetFile } from "./useImportPipeline";
import { SheetMapper, type SheetSelection } from "./SheetMapper";

type Step = "processing" | "mapping" | "review" | "saving" | "summary";
const PAGE = 25;

const STEPS = ["Choose source", "Upload", "Extract", "Validate", "Review", "Confirm", "Summary"];

export function StepBar({ current }: { current: number }) {
  return (
    <ol className="flex gap-1 overflow-x-auto text-xs">
      {STEPS.map((s, i) => (
        <li key={s} className={`whitespace-nowrap rounded-full px-2.5 py-1 ${i <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}

export function ImportWizard({ input, onReset }: { input: { files?: File[]; text?: string; scanImages?: Blob[] }; onReset: () => void }) {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const country = profile.data?.default_country ?? "IN";
  const { run, progress, cancel } = useImportPipeline(country);
  const [step, setStep] = useState<Step>("processing");
  const [drafts, setDrafts] = useState<ContactDraft[]>([]);
  const [sheets, setSheets] = useState<SheetFile[]>([]);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchIdentityIndex>>>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<Record<string, DupAction>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [started, setStarted] = useState(false);

  const rows = useMemo(() => analyze(drafts, existing, country), [drafts, existing, country]);
  const sum = summarize(rows);
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  async function toReview(ds: ContactDraft[]) {
    const idx = await fetchIdentityIndex();
    setExisting(idx);
    setDrafts(ds);
    const an = analyze(ds, idx, country);
    setSelected(new Set(an.filter((r) => r.status === "valid" || r.status === "review").map((r) => r.draft.key)));
    setStep("review");
  }

  if (!started && profile.data) {
    setStarted(true);
    (async () => {
      const files = input.files ?? [];
      const type = input.scanImages?.length ? "scan" : input.text ? (files.length ? "mixed" : "text") : files.length === 1 ? "mixed" : "mixed";
      try {
        const id = await createJob(type as never, files.map((f) => f.name).join(", ") || (input.text ? "Pasted text" : "Camera scan"));
        setJobId(id);
      } catch (e) {
        toast.error((e as Error).message);
      }
      const r = await run(input);
      r.warnings.forEach((w) => toast.warning(w, { duration: 10000 }));
      if (r.sheets.length) {
        setDrafts(r.drafts);
        setSheets(r.sheets);
        setStep("mapping");
      } else await toReview(r.drafts);
    })();
  }

  async function applySheets(sel: SheetSelection[]) {
    const out = [...drafts];
    let n = 0;
    for (const s of sel) {
      const sheet = s.file.sheets[s.sheetIdx];
      for (let i = 0; i < sheet.rows.length; i++) {
        const d = draftFromRow(sheet.rows[i], s.mapping, { country, sourceFilename: s.file.name, sourceType: s.file.sourceType, location: `${sheet.name} · row ${i + 2}` });
        if (d) out.push(d);
        if (++n % 500 === 0) await yieldToUI();
      }
    }
    await toReview(out);
  }

  async function save(keys: string[]) {
    if (!jobId) return toast.error("Could not start the import job");
    const chosen = rows.filter((r) => keys.includes(r.draft.key) && r.status !== "invalid");
    const blocked = rows.filter((r) => keys.includes(r.draft.key) && r.status === "invalid").length;
    if (!chosen.length) return toast.error(blocked ? "Fix invalid records before importing them" : "Select at least one contact");
    setStep("saving");
    try {
      const res = await commitImport(jobId, chosen, actions);
      res.failed += blocked;
      setResult(res);
      qc.invalidateQueries();
      setStep("summary");
    } catch (e) {
      toast.error((e as Error).message);
      setStep("review");
    }
  }

  function edit(key: string, fields: ContactDraft["fields"]) {
    setDrafts((p) => p.map((d) => (d.key === key ? { ...d, fields, ambiguous: [], confidence: Math.max(d.confidence, 0.9) } : d)));
  }

  async function cancelAll() {
    cancel();
    if (jobId) {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("import_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", jobId);
    }
    onReset();
  }

  if (step === "processing" || step === "saving") {
    const done = progress.filter((p) => p.status === "done" || p.status === "failed").length;
    return (
      <div className="space-y-4">
        <StepBar current={step === "saving" ? 5 : 2} />
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> {step === "saving" ? "Saving contacts…" : `Extracting… ${done}/${progress.length}`}
          </div>
          {step === "processing" && <Progress value={progress.length ? (done / progress.length) * 100 : 5} />}
          <ul className="mt-4 divide-y text-sm">
            {progress.map((p, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <span className="truncate">{p.name}</span>
                <span className={p.status === "failed" ? "text-right text-destructive" : "text-muted-foreground"}>
                  {p.status === "processing" ? "reading…" : p.status === "done" ? `${p.found} found` : p.status === "failed" ? p.error : "queued"}
                </span>
              </li>
            ))}
          </ul>
          {step === "processing" && <Button variant="outline" className="mt-4" onClick={cancelAll}>Cancel</Button>}
        </div>
      </div>
    );
  }

  if (step === "mapping") {
    return (
      <div className="space-y-4">
        <StepBar current={3} />
        <p className="text-sm text-muted-foreground">Choose worksheets and check how columns map to contact fields.</p>
        <SheetMapper files={sheets} onDone={applySheets} />
      </div>
    );
  }

  if (step === "summary" && result) {
    return (
      <div className="space-y-4">
        <StepBar current={6} />
        <div className="rounded-xl border bg-card p-6">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <h2 className="mt-3 text-xl font-bold">Import complete</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            <Stat label="Detected" v={sum.total} />
            <Stat label="Imported" v={result.imported} />
            <Stat label="Updated existing" v={result.updated} />
            <Stat label="Skipped" v={result.skipped} />
            <Stat label="Failed" v={result.failed} />
          </ul>
          {result.errors.length > 0 && <p className="mt-3 text-sm text-destructive">{[...new Set(result.errors)].slice(0, 3).join(" · ")}</p>}
          <div className="mt-6 flex gap-2">
            <Button asChild><Link to="/contacts">View contacts</Link></Button>
            <Button variant="outline" onClick={onReset}>Import more</Button>
          </div>
        </div>
      </div>
    );
  }

  // Review
  const pageRows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const failedFiles = progress.filter((p) => p.status === "failed");
  return (
    <div className="space-y-4">
      <StepBar current={4} />
      {failedFiles.map((f) => (
        <div key={f.name} className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <XCircle className="h-4 w-4 shrink-0 text-destructive" /> <strong>{f.name}:</strong> {f.error}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {([["all", "Detected", sum.total], ["valid", "Valid", sum.valid], ["duplicate", "Possible duplicates", sum.duplicates], ["review", "Need review", sum.review], ["invalid", "Failed validation", sum.invalid]] as const).map(([k, l, v]) => (
          <button key={k} onClick={() => { setFilter(k); setPage(0); }} className={`rounded-xl border bg-card p-3 text-left ${filter === k ? "ring-2 ring-primary" : ""}`}>
            <div className="font-display text-xl font-bold">{v}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No contacts were found in this source. <Button variant="link" onClick={onReset}>Try another</Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm">
            <Checkbox
              aria-label="Select all"
              checked={shown.length > 0 && shown.every((r) => selected.has(r.draft.key))}
              onCheckedChange={(c) => setSelected((p) => { const n = new Set(p); shown.forEach((r) => (c ? n.add(r.draft.key) : n.delete(r.draft.key))); return n; })}
            />
            <span>{selected.size} selected</span>
          </div>
          <ul className="divide-y">
            {pageRows.map((r) => {
              const d = r.draft;
              const isOpen = open === d.key;
              return (
                <li key={d.key} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={selected.has(d.key)} onCheckedChange={(c) => setSelected((p) => { const n = new Set(p); c ? n.add(d.key) : n.delete(d.key); return n; })} aria-label={`Select ${displayName(d.fields)}`} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : d.key)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{displayName(d.fields)}</span>
                        <StatusBadge s={r.status} />
                        {d.confidence < 0.6 && <Badge variant="outline">low confidence</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[formatPhone(d.fields.phone) || d.fields.phone, d.fields.email, d.fields.company, d.sourceFilename, d.sourceLocation].filter(Boolean).join(" · ")}
                      </div>
                      {r.issues.length > 0 && <div className="mt-1 text-xs text-warning-foreground">{r.issues.map((i) => i.message).join(" · ")}</div>}
                    </button>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <Button size="icon" variant="ghost" aria-label="Remove record" onClick={() => setDrafts((p) => p.filter((x) => x.key !== d.key))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {(r.dups.length > 0 || r.batchDupOf) && (
                    <div className="ml-7 mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning/10 p-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                      {r.batchDupOf ? "Same phone/email appears earlier in this import." : `Matches an existing contact by ${r.dups[0].reason}${r.dups[0].strong ? "" : " (name only — may be a different person)"}.`}
                      {r.dups[0] && (
                        <Select value={actions[d.key] ?? (r.dups[0].strong ? "skip" : "create")} onValueChange={(v) => setActions((p) => ({ ...p, [d.key]: v as DupAction }))}>
                          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip</SelectItem>
                            <SelectItem value="update">Update existing (fill empty fields)</SelectItem>
                            {!r.dups[0].strong && <SelectItem value="create">Create as new contact</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                      {r.dups[0] && <Link to="/contacts/$id" params={{ id: r.dups[0].id }} target="_blank" className="underline">View existing</Link>}
                    </div>
                  )}
                  {isOpen && (
                    <div className="ml-7 mt-3 space-y-2">
                      <ContactForm value={d.fields} onChange={(f) => edit(d.key, f)} issues={r.issues} ambiguous={d.ambiguous} />
                      <Button size="sm" variant="outline" onClick={() => edit(d.key, normalizeFields(d.fields, country))}>Normalize numbers</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {shown.length > PAGE && (
            <div className="flex items-center justify-center gap-3 border-t p-3 text-sm">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              Page {page + 1} / {Math.ceil(shown.length / PAGE)}
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
      <div className="sticky bottom-20 flex flex-wrap justify-end gap-2 rounded-xl border bg-card p-3 md:bottom-4">
        <Button variant="ghost" onClick={cancelAll}>Cancel import</Button>
        <Button variant="outline" onClick={() => save(rows.filter((r) => r.status === "valid").map((r) => r.draft.key))} disabled={!sum.valid}>
          Import all valid ({sum.valid})
        </Button>
        <Button onClick={() => save([...selected])} disabled={!selected.size}>Import selected ({selected.size})</Button>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <li className="rounded-lg bg-muted p-3">
      <div className="font-display text-xl font-bold">{v}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </li>
  );
}

function StatusBadge({ s }: { s: string }) {
  if (s === "valid") return <Badge className="bg-success text-success-foreground">valid</Badge>;
  if (s === "invalid") return <Badge variant="destructive">invalid</Badge>;
  if (s === "duplicate") return <Badge className="bg-warning text-warning-foreground">duplicate</Badge>;
  return <Badge variant="secondary">review</Badge>;
}
