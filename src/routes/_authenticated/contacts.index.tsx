import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, MessageCircle, Search, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, EmptyState, headMeta } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { CallButton, WhatsAppButton } from "@/components/contacts/ContactActions";
import { BulkWhatsApp } from "@/components/contacts/BulkWhatsApp";
import { ExportDialog } from "@/components/contacts/ExportDialog";
import { formatPhone, normalizePhone } from "@/lib/contacts/phone";
import { waNumber } from "@/lib/contacts/whatsapp";
import type { Contact } from "@/lib/contacts/types";

const PAGE = 50;
const search = z.object({
  q: z.string().optional(),
  source: z.string().optional(),
  follow: z.string().optional(),
  sort: z.enum(["newest", "oldest", "name", "last_contacted"]).optional(),
  page: z.number().optional(),
  since: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/contacts/")({
  validateSearch: search,
  head: () => headMeta("All Contacts", "Search, filter, call and message your contacts."),
  component: ContactsPage,
});

function applyFilters<T extends { or: Function; eq: Function; gte: Function }>(q: T, s: z.infer<typeof search>): T {
  let r = q;
  if (s.q) {
    const t = s.q.replace(/[%,()]/g, " ").trim();
    r = r.or(`full_name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%,company.ilike.%${t}%,city.ilike.%${t}%`);
  }
  if (s.source) r = r.eq("source_type", s.source);
  if (s.follow) r = r.eq("follow_up_status", s.follow);
  if (s.since) r = r.gte("created_at", s.since);
  return r;
}

function ContactsPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/contacts/" });
  const qc = useQueryClient();
  const [q, setQ] = useState(s.q ?? "");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [bulk, setBulk] = useState<Contact[] | null>(null);
  const [exp, setExp] = useState(false);
  const page = s.page ?? 0;

  useEffect(() => {
    const t = setTimeout(() => q !== (s.q ?? "") && navigate({ search: (p) => ({ ...p, q: q || undefined, page: 0 }) }), 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useQuery({
    queryKey: ["contacts", s],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let qb = applyFilters(supabase.from("contacts").select("*", { count: "exact" }), s);
      const sort = s.sort ?? "newest";
      qb =
        sort === "name"
          ? qb.order("full_name", { ascending: true, nullsFirst: false })
          : sort === "oldest"
            ? qb.order("created_at", { ascending: true })
            : sort === "last_contacted"
              ? qb.order("last_contacted_at", { ascending: false, nullsFirst: false })
              : qb.order("created_at", { ascending: false });
      const { data, count, error } = await qb.range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data as Contact[], count: count ?? 0 };
    },
  });
  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));

  async function loadSelectedOrAll(): Promise<Contact[]> {
    if (sel.size) {
      const ids = [...sel];
      const out: Contact[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from("contacts").select("*").in("id", ids.slice(i, i + 200));
        out.push(...((data ?? []) as Contact[]));
      }
      return out;
    }
    const out: Contact[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await applyFilters(supabase.from("contacts").select("*"), s).order("full_name").range(from, from + 999);
      out.push(...((data ?? []) as Contact[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  async function del() {
    const ids = [...sel];
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("contacts").delete().in("id", ids.slice(i, i + 200));
      if (error) return toast.error(error.message);
    }
    toast.success(`Deleted ${ids.length} contacts`);
    setSel(new Set());
    qc.invalidateQueries();
  }

  return (
    <div>
      <PageHeader
        title="All Contacts"
        description={`${total} contacts`}
        actions={
          <>
            <Button variant="outline" onClick={() => setExp(true)}>
              <Download className="h-4 w-4" /> Export{sel.size ? ` (${sel.size})` : ""}
            </Button>
            <Button asChild>
              <Link to="/contacts/new">
                <UserPlus className="h-4 w-4" /> Add
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9" placeholder="Search name, phone, email, company, city" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={s.source ?? "all"} onValueChange={(v) => navigate({ search: (p) => ({ ...p, source: v === "all" ? undefined : v, page: 0 }) })}>
            <SelectTrigger className="h-11 md:w-36"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {["image", "scan", "pdf", "excel", "csv", "word", "text", "manual"].map((x) => (
                <SelectItem key={x} value={x}>{x}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.follow ?? "all"} onValueChange={(v) => navigate({ search: (p) => ({ ...p, follow: v === "all" ? undefined : v, page: 0 }) })}>
            <SelectTrigger className="h-11 md:w-40"><SelectValue placeholder="Follow-up" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any follow-up</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
          <Select value={s.since ? "custom" : "all"} onValueChange={(v) => {
            const d = new Date();
            if (v === "today") d.setHours(0, 0, 0, 0);
            if (v === "7") d.setDate(d.getDate() - 7);
            if (v === "30") d.setDate(d.getDate() - 30);
            navigate({ search: (p) => ({ ...p, since: v === "all" ? undefined : d.toISOString(), page: 0 }) });
          }}>
            <SelectTrigger className="h-11 md:w-36"><SelectValue placeholder="Imported" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              {s.since && <SelectItem value="custom">Filtered</SelectItem>}
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={s.sort ?? "newest"} onValueChange={(v) => navigate({ search: (p) => ({ ...p, sort: v as never }) })}>
            <SelectTrigger className="h-11 md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="last_contacted">Last contacted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sel.size > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-accent p-3">
            <span className="text-sm font-medium">{sel.size} selected</span>
            <Button size="sm" className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" onClick={async () => setBulk(await loadSelectedOrAll())}>
              <MessageCircle className="h-4 w-4" /> WhatsApp one by one
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          </div>
        )}

        {list.isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No contacts found" text="Try another search or import contacts." action={<Button asChild><Link to="/import">Import</Link></Button>} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
              <Checkbox
                aria-label="Select all on page"
                checked={allSel}
                onCheckedChange={(c) => setSel((p) => { const n = new Set(p); rows.forEach((r) => (c ? n.add(r.id) : n.delete(r.id))); return n; })}
              />
              <span>Select page</span>
              <button className="ml-2 text-primary hover:underline" onClick={async () => {
                const all = await loadSelectedOrAll();
                setSel(new Set(all.filter((c) => normalizePhone(waNumber(c)).valid).map((c) => c.id)));
              }}>Select all with valid numbers</button>
            </div>
            <ul className="divide-y">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Checkbox
                    aria-label={`Select ${c.full_name ?? ""}`}
                    checked={sel.has(c.id)}
                    onCheckedChange={(v) => setSel((p) => { const n = new Set(p); v ? n.add(c.id) : n.delete(c.id); return n; })}
                  />
                  <Link to="/contacts/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.full_name ?? c.company ?? "Unnamed"}</span>
                      {c.follow_up_status === "pending" && <Badge variant="secondary">follow-up</Badge>}
                      {c.verification_status === "needs_review" && <Badge variant="outline">review</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[formatPhone(c.phone), c.email, c.company, c.city].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                  <CallButton contact={c} />
                  <WhatsAppButton contact={c} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {total > PAGE && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page === 0} onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
            <Button variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}>Next</Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {sel.size} contacts?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes them and their activity history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {bulk && <BulkWhatsApp contacts={bulk} open onOpenChange={(o) => !o && (setBulk(null), qc.invalidateQueries())} />}
      <ExportDialog open={exp} onOpenChange={setExp} load={loadSelectedOrAll} />
    </div>
  );
}
