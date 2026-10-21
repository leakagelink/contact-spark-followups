import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone, normalizePhone } from "@/lib/contacts/phone";
import { recordWhatsApp } from "@/lib/contacts/db";
import { renderTemplate, waNumber, whatsappUrl } from "@/lib/contacts/whatsapp";
import type { Contact } from "@/lib/contacts/types";
import { useTemplates } from "./useTemplates";

type Status = "pending" | "opened" | "skipped" | "failed";

/** One-at-a-time queue: every recipient needs its own explicit tap. Nothing is sent automatically. */
export function BulkWhatsApp({ contacts, open, onOpenChange }: { contacts: Contact[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: templates = [] } = useTemplates();
  const [tpl, setTpl] = useState("");
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>(() =>
    Object.fromEntries(contacts.map((c) => [c.id, normalizePhone(waNumber(c)).valid ? "pending" : "failed"])),
  );
  const body = tpl || templates[0]?.body || "";
  const current = useMemo(() => contacts.find((c) => status[c.id] === "pending"), [contacts, status]);
  const counts = Object.values(status).reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {} as Record<Status, number>);

  async function openCurrent() {
    if (!current) return;
    const msg = renderTemplate(body, current);
    const url = whatsappUrl(waNumber(current), msg);
    if (!url) return setStatus((s) => ({ ...s, [current.id]: "failed" }));
    window.open(url, "_blank", "noopener");
    setStatus((s) => ({ ...s, [current.id]: "opened" }));
    recordWhatsApp(current.id, waNumber(current)!, "whatsapp_opened", msg).catch(console.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WhatsApp {contacts.length} contacts</DialogTitle>
          <DialogDescription>Each chat opens one at a time. You send every message yourself in WhatsApp.</DialogDescription>
        </DialogHeader>
        {!started ? (
          <div className="space-y-3">
            <Select onValueChange={(id) => setTpl(templates.find((t) => t.id === id)?.body ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea rows={4} value={body} onChange={(e) => setTpl(e.target.value)} aria-label="Message" />
            {contacts[0] && (
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm">{renderTemplate(body, contacts[0])}</pre>
            )}
            <Button className="w-full" disabled={!body} onClick={() => setStarted(true)}>
              Prepare queue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Pending {counts.pending ?? 0}</Badge>
              <Badge variant="secondary">Opened {counts.opened ?? 0}</Badge>
              <Badge variant="secondary">Skipped {counts.skipped ?? 0}</Badge>
              <Badge variant="destructive">Failed {counts.failed ?? 0}</Badge>
            </div>
            {current ? (
              <div className="rounded-lg border p-4">
                <div className="font-semibold">{current.full_name ?? "Unnamed"}</div>
                <div className="text-sm text-muted-foreground">{formatPhone(waNumber(current))}</div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{renderTemplate(body, current)}</pre>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" onClick={openCurrent}>
                    Open WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => setStatus((s) => ({ ...s, [current.id]: "skipped" }))}>
                    Skip
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">Queue finished.</p>
            )}
            <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate">{c.full_name ?? formatPhone(c.phone)}</span>
                  <span className="text-xs text-muted-foreground">
                    {status[c.id] === "failed" ? "no valid number" : status[c.id]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
