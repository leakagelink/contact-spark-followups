import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader, headMeta } from "@/components/PageHeader";
import { ExportDialog } from "@/components/contacts/ExportDialog";
import { useTemplates } from "@/components/contacts/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/contacts/db";
import { deleteMyAccount } from "@/lib/extract.functions";
import { download } from "@/lib/contacts/export";
import type { Contact } from "@/lib/contacts/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => headMeta("Settings", "Profile, message templates, data export and account."),
  component: Settings,
});

async function allContacts() {
  const out: Contact[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await supabase.from("contacts").select("*").order("created_at").range(f, f + 999);
    out.push(...((data ?? []) as Contact[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const { data: templates = [] } = useTemplates();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("IN");
  const [tName, setTName] = useState("");
  const [tBody, setTBody] = useState("");
  const [exp, setExp] = useState(false);
  useEffect(() => {
    if (profile.data) { setName(profile.data.display_name ?? ""); setCountry(profile.data.default_country); }
  }, [profile.data]);

  async function saveProfile() {
    const { error } = await supabase.from("profiles").upsert({ id: profile.data!.id, display_name: name, default_country: country });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function addTemplate() {
    const { error } = await supabase.from("message_templates").insert({ name: tName, body: tBody });
    if (error) return toast.error(error.message);
    setTName(""); setTBody("");
    qc.invalidateQueries({ queryKey: ["templates"] });
  }
  async function exportAll() {
    const tables = ["contacts", "contact_activities", "follow_up_tasks", "import_jobs", "message_templates"] as const;
    const out: Record<string, unknown> = {};
    for (const t of tables) out[t] = (await supabase.from(t).select("*").limit(10000)).data;
    download(JSON.stringify(out, null, 2), "my-contactflow-data.json", "application/json");
  }
  async function deleteAccount() {
    try {
      await del();
      await supabase.auth.signOut();
      qc.clear();
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Profile</h2>
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Default country for phone numbers</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {getCountries().map((c) => <SelectItem key={c} value={c}>{c} (+{getCountryCallingCode(c)})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Numbers without a country code are read as this country.</p>
          </div>
          <Button onClick={saveProfile}>Save</Button>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">WhatsApp templates</h2>
          <ul className="space-y-2 text-sm">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted p-3">
                <div><div className="font-medium">{t.name}</div><div className="text-muted-foreground">{t.body}</div></div>
                {t.id !== "default" && (
                  <Button size="icon" variant="ghost" aria-label="Delete template" onClick={async () => { await supabase.from("message_templates").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: ["templates"] }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Input placeholder="Template name" value={tName} onChange={(e) => setTName(e.target.value)} />
          <Textarea placeholder="Hello {{name}}, …" value={tBody} onChange={(e) => setTBody(e.target.value)} />
          <p className="text-xs text-muted-foreground">Placeholders: {"{{name}} {{phone}} {{company}}"}</p>
          <Button variant="outline" disabled={!tName || !tBody} onClick={addTemplate}>Add template</Button>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Your data</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExp(true)}>Export contacts (Excel / CSV / vCard)</Button>
            <Button variant="outline" onClick={exportAll}>Download all my data (JSON)</Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">Delete my account</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>All contacts, imports and activity are permanently deleted. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount}>Delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
      <ExportDialog open={exp} onOpenChange={setExp} load={allContacts} />
    </div>
  );
}
