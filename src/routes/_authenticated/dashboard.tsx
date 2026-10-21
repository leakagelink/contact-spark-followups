import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { Bell, ClipboardPaste, FileUp, Mail, MessageCircle, Phone, ScanLine, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, headMeta } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { CallButton, WhatsAppButton } from "@/components/contacts/ContactActions";
import { formatPhone } from "@/lib/contacts/phone";
import type { Contact } from "@/lib/contacts/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => headMeta("Dashboard", "Your contacts, imports and follow-ups at a glance."),
  component: Dashboard,
});

async function count(q: (b: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const { count } = await q(base());
  return count ?? 0;
}
const base = () => supabase.from("contacts").select("id", { count: "exact", head: true });

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString();
      const [total, todayN, mobile, email, wa, follow] = await Promise.all([
        count((b) => b),
        count((b) => b.gte("created_at", today)),
        count((b) => b.not("phone", "is", null)),
        count((b) => b.not("email", "is", null)),
        count((b) => b.not("whatsapp_phone", "is", null)),
        count((b) => b.eq("follow_up_status", "pending")),
      ]);
      return { total, todayN, mobile, email, wa, follow };
    },
  });
  const recent = useQuery({
    queryKey: ["dash-recent"],
    queryFn: async () => (await supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(8)).data as Contact[],
  });
  const jobs = useQuery({
    queryKey: ["dash-jobs"],
    queryFn: async () => (await supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
  const acts = useQuery({
    queryKey: ["dash-acts"],
    queryFn: async () =>
      (await supabase.from("contact_activities").select("*, contacts(full_name)").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  const s = stats.data;
  const cards = [
    { label: "Total contacts", v: s?.total, icon: Users },
    { label: "Imported today", v: s?.todayN, icon: FileUp },
    { label: "With mobile", v: s?.mobile, icon: Phone },
    { label: "With email", v: s?.email, icon: Mail },
    { label: "With WhatsApp", v: s?.wa, icon: MessageCircle },
    { label: "Awaiting follow-up", v: s?.follow, icon: Bell },
  ];
  const actions = [
    { to: "/import", search: { tab: "files" }, label: "Import File", icon: FileUp },
    { to: "/scan", label: "Scan Document", icon: ScanLine },
    { to: "/import", search: { tab: "paste" }, label: "Paste Text", icon: ClipboardPaste },
    { to: "/contacts/new", label: "Add Manually", icon: UserPlus },
    { to: "/contacts", label: "View All", icon: Users },
  ] as const;

  return (
    <div>
      <PageHeader title="Dashboard" description="Extract, import, call and follow up." />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {actions.map((a) => (
            <Button key={a.label} asChild variant={a.label === "Import File" ? "default" : "outline"} className="h-auto flex-col gap-2 py-4">
              <Link to={a.to} {...("search" in a ? { search: a.search as never } : {})}>
                <a.icon className="h-5 w-5" />
                {a.label}
              </Link>
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
              <c.icon className="h-4 w-4 text-primary" />
              <div className="mt-2 font-display text-2xl font-bold">{c.v ?? "–"}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border bg-card lg:col-span-2">
            <h2 className="border-b px-4 py-3 font-semibold">Recent contacts</h2>
            {recent.data?.length ? (
              <ul className="divide-y">
                {recent.data.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Link to="/contacts/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.full_name ?? c.company ?? "Unnamed"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[formatPhone(c.phone), c.email, c.source_type].filter(Boolean).join(" · ")}
                      </div>
                    </Link>
                    <CallButton contact={c} />
                    <WhatsAppButton contact={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState icon={Users} title="No contacts yet" text="Import a file, scan a card or paste text to get started." action={<Button asChild><Link to="/import">Import contacts</Link></Button>} />
              </div>
            )}
          </section>
          <div className="space-y-6">
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-4 py-3 font-semibold">Recent imports</h2>
              <ul className="divide-y text-sm">
                {(jobs.data ?? []).map((j) => (
                  <li key={j.id} className="px-4 py-2.5">
                    <div className="truncate font-medium">{j.source_filename ?? j.source_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.successful_records} imported · {j.duplicate_records} duplicates · {j.status}
                    </div>
                  </li>
                ))}
                {!jobs.data?.length && <li className="px-4 py-4 text-muted-foreground">No imports yet</li>}
              </ul>
            </section>
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-4 py-3 font-semibold">Recent activity</h2>
              <ul className="divide-y text-sm">
                {(acts.data ?? []).map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="font-medium">{(a.contacts as { full_name: string | null } | null)?.full_name ?? "Contact"}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.activity_type.replace(/_/g, " ")} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </li>
                ))}
                {!acts.data?.length && <li className="px-4 py-4 text-muted-foreground">No calls or messages yet</li>}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
