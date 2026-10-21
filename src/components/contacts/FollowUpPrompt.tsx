import { useCallback, useEffect, useState } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearIfStale, markHandled, markLeft, readPending, shouldPrompt, type PendingCall } from "@/lib/contacts/call-followup";
import { recordWhatsApp } from "@/lib/contacts/db";
import { formatPhone } from "@/lib/contacts/phone";
import type { Contact } from "@/lib/contacts/types";
import { WhatsAppComposer } from "./WhatsAppComposer";

/**
 * Return-from-dialer prompt. We cannot know if the call connected or ended — only that the user
 * tapped Call, left the app, and came back. The prompt says exactly that.
 */
export function FollowUpPrompt() {
  const [pending, setPending] = useState<PendingCall | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [compose, setCompose] = useState(false);
  const qc = useQueryClient();

  const check = useCallback(async () => {
    const p = readPending(localStorage);
    if (!shouldPrompt(p)) {
      clearIfStale(localStorage);
      return;
    }
    const { data } = await supabase.from("contacts").select("*").eq("id", p!.contactId).maybeSingle();
    if (!data) return markHandled(localStorage);
    setContact(data as Contact);
    setPending(p);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") markLeft(localStorage);
      else check();
    };
    const onBlur = () => markLeft(localStorage);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onBlur);
    window.addEventListener("focus", check);
    // Native Android build: Capacitor's App plugin, if present, reports app state reliably.
    const cap = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener: (e: string, cb: (s: { isActive: boolean }) => void) => Promise<{ remove: () => void }> } } } }).Capacitor;
    let remove: (() => void) | undefined;
    cap?.Plugins?.App?.addListener("appStateChange", (s) => (s.isActive ? check() : markLeft(localStorage))).then((h) => (remove = h.remove));
    check();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onBlur);
      window.removeEventListener("focus", check);
      remove?.();
    };
  }, [check]);

  async function finish(status: "whatsapp_opened" | "skipped") {
    markHandled(localStorage);
    if (pending && contact) {
      await supabase.from("follow_up_tasks").insert({
        contact_id: contact.id,
        activity_id: pending.activityId,
        phone_number: pending.phone,
        status,
        completed_at: new Date().toISOString(),
      });
      if (status === "skipped") await recordWhatsApp(contact.id, pending.phone, "whatsapp_skipped").catch(() => {});
    }
    setPending(null);
    qc.invalidateQueries();
  }

  if (!pending || !contact) return null;
  return (
    <>
      <Dialog open={!compose} onOpenChange={(o) => !o && finish("skipped")}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" /> Call follow-up
            </DialogTitle>
            <DialogDescription>You opened the dialer for this contact and came back to the app.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-4 text-sm">
            <div>
              <span className="text-muted-foreground">Contact:</span> <strong>{contact.full_name ?? "—"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Number:</span> <strong>{formatPhone(pending.phone)}</strong>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:flex-col">
            <Button className="h-11 w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" onClick={() => setCompose(true)}>
              <MessageCircle className="h-4 w-4" /> Share Details on WhatsApp
            </Button>
            <Button variant="outline" className="h-11 w-full" onClick={() => finish("skipped")}>
              Skip WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {compose && (
        <WhatsAppComposer
          contact={{ ...contact, whatsapp_phone: contact.whatsapp_phone ?? pending.phone }}
          open={compose}
          onOpenChange={(o) => {
            setCompose(o);
            if (!o) finish("whatsapp_opened");
          }}
        />
      )}
    </>
  );
}
