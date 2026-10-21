import { supabase } from "@/integrations/supabase/client";
import type { CountryCode } from "libphonenumber-js";
import { savePending } from "./call-followup";
import type { Contact, ContactFields } from "./types";

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function getProfile() {
  const uid = await currentUserId();
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return {
    id: uid,
    display_name: data?.display_name ?? null,
    default_country: (data?.default_country ?? "IN") as CountryCode,
    followup_template: data?.followup_template ?? null,
  };
}

export async function getContact(id: string) {
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Contact | null;
}

/** All contacts' identity fields — used for duplicate detection (paged past the 1000-row limit). */
export async function fetchIdentityIndex() {
  const out: ({ id: string } & ContactFields)[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, full_name, phone, secondary_phone, whatsapp_phone, email, secondary_email")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function logActivity(a: {
  contact_id: string;
  activity_type: string;
  phone_number?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("contact_activities")
    .insert({ ...a, metadata: (a.metadata ?? {}) as never })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Records the call initiation, saves the return-from-dialer context, then opens the dialer. */
export async function startCall(contact: { id: string; full_name: string | null }, phone: string) {
  let activityId: string | null = null;
  try {
    activityId = await logActivity({ contact_id: contact.id, activity_type: "call_initiated", phone_number: phone, status: "dialer_opened" });
    await supabase.from("contacts").update({ last_contacted_at: new Date().toISOString() }).eq("id", contact.id);
  } catch (e) {
    console.error(e);
  }
  savePending({ contactId: contact.id, name: contact.full_name || phone, phone, activityId }, localStorage);
  window.location.href = `tel:${phone}`;
}

export async function recordWhatsApp(contactId: string, phone: string, kind: "whatsapp_opened" | "whatsapp_skipped" | "details_shared", message?: string) {
  await logActivity({ contact_id: contactId, activity_type: kind, phone_number: phone, metadata: message ? { message } : {} });
  if (kind !== "whatsapp_skipped")
    await supabase.from("contacts").update({ last_contacted_at: new Date().toISOString() }).eq("id", contactId);
}
