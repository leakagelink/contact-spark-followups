import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, headMeta } from "@/components/PageHeader";
import { ContactForm } from "@/components/contacts/ContactForm";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, fetchIdentityIndex } from "@/lib/contacts/db";
import { findDuplicates } from "@/lib/contacts/duplicates";
import { hasBlocking, normalizeFields, validateFields } from "@/lib/contacts/validation";
import type { ContactFields } from "@/lib/contacts/types";

export const Route = createFileRoute("/_authenticated/contacts/new")({
  head: () => headMeta("Add contact", "Add a contact manually."),
  component: NewContact,
});

function NewContact() {
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [f, setF] = useState<ContactFields>({});
  const [busy, setBusy] = useState(false);
  const country = profile.data?.default_country ?? "IN";
  const issues = validateFields(f, country);

  async function save() {
    if (hasBlocking(issues)) return toast.error("Fix the highlighted fields first");
    setBusy(true);
    const fields = normalizeFields(f, country);
    const dup = findDuplicates(fields, await fetchIdentityIndex()).find((d) => d.strong);
    if (dup) {
      setBusy(false);
      toast.error(`A contact with the same ${dup.reason} already exists`, {
        action: { label: "Open", onClick: () => navigate({ to: "/contacts/$id", params: { id: dup.id } }) },
      });
      return;
    }
    const { data, error } = await supabase.from("contacts").insert({ ...fields, source_type: "manual", verification_status: "verified" }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    navigate({ to: "/contacts/$id", params: { id: data.id } });
  }
  return (
    <div>
      <PageHeader title="Add contact" />
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
        <div className="rounded-xl border bg-card p-5">
          <ContactForm value={f} onChange={setF} issues={issues.filter((i) => i.code !== "missing_name" || Object.keys(f).length > 0)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save contact"}</Button>
        </div>
      </div>
    </div>
  );
}
