import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, GitMerge, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, headMeta } from "@/components/PageHeader";
import { ContactForm } from "@/components/contacts/ContactForm";
import { CallButton, WhatsAppButton } from "@/components/contacts/ContactActions";
import { supabase } from "@/integrations/supabase/client";
import { getContact, getProfile, fetchIdentityIndex, logActivity } from "@/lib/contacts/db";
import { findDuplicates } from "@/lib/contacts/duplicates";
import { normalizeFields, validateFields, hasBlocking } from "@/lib/contacts/validation";
import { formatPhone } from "@/lib/contacts/phone";
import { CONTACT_FIELDS, FIELD_LABELS, type Contact, type ContactFields } from "@/lib/contacts/types";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  head: () => headMeta("Contact", "Contact details, activity and follow-ups."),
  component: Detail,
});

function pick(c: Contact): ContactFields {
  return Object.fromEntries(CONTACT_FIELDS.map((f) => [f, c[f]])) as ContactFields;
}

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const contact = useQuery({ queryKey: ["contact", id], queryFn: () => getContact(id) });
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const acts = useQuery({
    queryKey: ["acts", id],
    queryFn: async () => (await supabase.from("contact_activities").select("*").eq("contact_id", id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const dups = useQuery({
    queryKey: ["dups", id],
    enabled: !!contact.data,
    queryFn: async () => {
      const idx = await fetchIdentityIndex();
      const m = findDuplicates(pick(contact.data!), idx.filter((x) => x.id !== id));
      if (!m.length) return [];
      const { data } = await supabase.from("contacts").select("*").in("id", m.map((x) => x.id));
      return (data ?? []).map((c) => ({ c: c as Contact, reason: m.find((x) => x.id === c.id)!.reason }));
    },
  });
  const [form, setForm] = useState<ContactFields>({});
  const [tag, setTag] = useState("");
  const [del, setDel] = useState(false);
  const [merge, setMerge] = useState<Contact | null>(null);
  useEffect(() => { if (contact.data) setForm(pick(contact.data)); }, [contact.data]);

  if (contact.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const c = contact.data;
  if (!c) return <div className="p-8">Contact not found. <Link to="/contacts" className="text-primary">Back</Link></div>;
  const country = profile.data?.default_country ?? "IN";
  const issues = validateFields(form, country);

  async function save() {
    if (hasBlocking(issues)) return toast.error("Fix the highlighted fields first");
    const { error } = await supabase.from("contacts").update({ ...normalizeFields(form, country), verification_status: "verified" }).eq("id", id);
    if (error) return toast.error(error.code === "23505" ? "Another contact already has this phone or email" : error.message);
    logActivity({ contact_id: id, activity_type: "edited" }).catch(() => {});
    toast.success("Saved");
    qc.invalidateQueries();
  }
  async function update(patch: Partial<Contact>) {
    const { error } = await supabase.from("contacts").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contact", id] });
  }
  async function remove() {
    await supabase.from("contacts").delete().eq("id", id);
    qc.invalidateQueries();
    navigate({ to: "/contacts" });
  }

  return (
    <div>
      <PageHeader
        title={c.full_name ?? c.company ?? "Unnamed contact"}
        description={[c.job_title, c.company].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="ghost" asChild><Link to="/contacts"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <CallButton contact={c} size="default" label />
            <WhatsAppButton contact={c} size="default" label />
          </>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-3">
        <section className="space-y-4 rounded-xl border bg-card p-5 lg:col-span-2">
          {dups.data && dups.data.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <strong>Possible duplicates:</strong>
              {dups.data.map((d) => (
                <div key={d.c.id} className="mt-2 flex items-center justify-between gap-2">
                  <Link to="/contacts/$id" params={{ id: d.c.id }} className="underline">
                    {d.c.full_name ?? formatPhone(d.c.phone)} (same {d.reason})
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => setMerge(d.c)}><GitMerge className="h-4 w-4" /> Compare & merge</Button>
                </div>
              ))}
            </div>
          )}
          <ContactForm value={form} onChange={setForm} issues={issues} />
          <div className="flex justify-between">
            <Button variant="ghost" className="text-destructive" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </section>
        <div className="space-y-6">
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Tags</h2>
            <div className="flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button aria-label={`Remove ${t}`} onClick={() => update({ tags: c.tags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) update({ tags: [...new Set([...c.tags, tag.trim()])] }); setTag(""); }}>
              <Input placeholder="Add tag (e.g. lead, vendor)" value={tag} onChange={(e) => setTag(e.target.value)} />
              <Button type="submit" variant="outline">Add</Button>
            </form>
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Follow-up reminder</h2>
            <Label className="text-xs">Remind me on</Label>
            <Input
              type="datetime-local"
              value={c.follow_up_at ? c.follow_up_at.slice(0, 16) : ""}
              onChange={(e) => update({ follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null, follow_up_status: e.target.value ? "pending" : "none" })}
            />
            <div className="flex gap-2">
              <Button size="sm" variant={c.follow_up_status === "pending" ? "default" : "outline"} onClick={() => update({ follow_up_status: "pending" })}>Pending</Button>
              <Button size="sm" variant={c.follow_up_status === "done" ? "default" : "outline"} onClick={() => update({ follow_up_status: "done" })}>Done</Button>
            </div>
          </section>
          <section className="rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Source</h2>
            <p className="text-muted-foreground">
              {c.source_type ?? "—"} {c.source_filename && `· ${c.source_filename}`} {c.source_location && `· ${c.source_location}`}
            </p>
            <p className="text-muted-foreground">Added {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
          </section>
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">Activity</h2>
            <ul className="divide-y text-sm">
              {(acts.data ?? []).map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <div className="font-medium capitalize">{a.activity_type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.phone_number && formatPhone(a.phone_number) + " · "}
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </li>
              ))}
              {!acts.data?.length && <li className="px-5 py-4 text-muted-foreground">No activity yet</li>}
            </ul>
          </section>
        </div>
      </div>
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>This removes the contact and its history permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {merge && <MergeDialog a={c} b={merge} onClose={() => { setMerge(null); qc.invalidateQueries(); }} />}
    </div>
  );
}

/** Side-by-side merge: user picks each field. Merged into A; B is deleted only after confirm. */
function MergeDialog({ a, b, onClose }: { a: Contact; b: Contact; onClose: () => void }) {
  const fields = CONTACT_FIELDS.filter((f) => a[f] || b[f]);
  const [choice, setChoice] = useState<Record<string, "a" | "b">>(() => Object.fromEntries(fields.map((f) => [f, a[f] ? "a" : "b"])));
  async function run() {
    const patch: Record<string, string | null> = {};
    for (const f of fields) patch[f] = choice[f] === "a" ? a[f] : b[f];
    if (!patch["secondary_phone"] && b.phone && b.phone !== patch["phone"]) patch["secondary_phone"] = b.phone;
    if (!patch["secondary_email"] && b.email && b.email !== patch["email"]) patch["secondary_email"] = b.email;
    // Free B's unique phone/email before writing them onto A.
    await supabase.from("contact_activities").update({ contact_id: a.id }).eq("contact_id", b.id);
    await supabase.from("follow_up_tasks").update({ contact_id: a.id }).eq("contact_id", b.id);
    const { error: e1 } = await supabase.from("contacts").delete().eq("id", b.id);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("contacts").update({ ...patch, tags: [...new Set([...a.tags, ...b.tags])] }).eq("id", a.id);
    if (error) return toast.error(error.message);
    await logActivity({ contact_id: a.id, activity_type: "merged", metadata: { merged_from: b.id } });
    toast.success("Contacts merged");
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare & merge</DialogTitle>
          <DialogDescription>Pick the value to keep for each field. The other contact will be removed.</DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-lg border text-sm">
          {fields.map((f) => (
            <div key={f} className="grid grid-cols-[110px_1fr_1fr] items-center gap-2 p-2">
              <span className="text-xs text-muted-foreground">{FIELD_LABELS[f]}</span>
              {(["a", "b"] as const).map((s) => {
                const v = (s === "a" ? a : b)[f];
                return (
                  <button
                    key={s}
                    disabled={!v}
                    onClick={() => setChoice((p) => ({ ...p, [f]: s }))}
                    className={`rounded-md border px-2 py-1.5 text-left ${choice[f] === s ? "border-primary bg-accent" : ""} disabled:opacity-40`}
                  >
                    {v ?? "—"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={run}>Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
