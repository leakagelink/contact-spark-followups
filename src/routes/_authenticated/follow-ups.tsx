import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, headMeta } from "@/components/PageHeader";
import { CallButton, WhatsAppButton } from "@/components/contacts/ContactActions";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/contacts/phone";
import type { Contact } from "@/lib/contacts/types";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => headMeta("Follow-ups", "Contacts waiting for a call or WhatsApp follow-up."),
  component: FollowUps,
});

function FollowUps() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ["followups"],
    queryFn: async () => (await supabase.from("contacts").select("*").eq("follow_up_status", "pending").order("follow_up_at", { ascending: true, nullsFirst: false }).limit(200)).data as Contact[],
  });
  const recentCalls = useQuery({
    queryKey: ["recent-calls"],
    queryFn: async () => (await supabase.from("contact_activities").select("*, contacts(*)").eq("activity_type", "call_initiated").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("follow_up_tasks").select("activity_id,status")).data ?? [],
  });
  const handled = new Map((tasks.data ?? []).map((t) => [t.activity_id, t.status]));

  async function done(id: string) {
    await supabase.from("contacts").update({ follow_up_status: "done" }).eq("id", id);
    qc.invalidateQueries();
  }

  return (
    <div>
      <PageHeader title="Follow-ups" description="Reminders and recent calls. Use these if the automatic prompt didn't appear." />
      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-semibold">Pending follow-ups</h2>
          {pending.data?.length ? (
            <ul className="divide-y">
              {pending.data.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-4 py-3">
                  <Link to="/contacts/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.full_name ?? formatPhone(c.phone)}</div>
                    <div className={`text-xs ${c.follow_up_at && new Date(c.follow_up_at) < new Date() ? "text-destructive" : "text-muted-foreground"}`}>
                      {c.follow_up_at ? `Due ${format(new Date(c.follow_up_at), "d MMM, p")}` : "No date"}
                    </div>
                  </Link>
                  <CallButton contact={c} />
                  <WhatsAppButton contact={c} />
                  <Button size="sm" variant="outline" aria-label="Mark done" onClick={() => done(c.id)}><Check className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4"><EmptyState icon={Bell} title="Nothing pending" text="Set a reminder from any contact's page." /></div>
          )}
        </section>
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-semibold">Recent calls — manual follow-up</h2>
          <ul className="divide-y">
            {(recentCalls.data ?? []).map((a) => {
              const c = a.contacts as Contact | null;
              if (!c) return null;
              const st = handled.get(a.id);
              return (
                <li key={a.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.full_name ?? formatPhone(a.phone_number)}</div>
                    <div className="text-xs text-muted-foreground">
                      Dialer opened {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      {st && ` · ${st.replace("_", " ")}`}
                    </div>
                  </div>
                  <WhatsAppButton contact={c} label />
                </li>
              );
            })}
            {!recentCalls.data?.length && <li className="px-4 py-6 text-sm text-muted-foreground">No calls yet</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
