import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone } from "@/lib/contacts/phone";
import { recordWhatsApp } from "@/lib/contacts/db";
import { renderTemplate, SHAREABLE_FIELDS, shareDetailsText, waNumber, whatsappUrl } from "@/lib/contacts/whatsapp";
import { FIELD_LABELS, type ContactField, type ContactFields } from "@/lib/contacts/types";
import { useTemplates } from "./useTemplates";

export function WhatsAppComposer({
  contact,
  open,
  onOpenChange,
  onDone,
  initialTemplate,
}: {
  contact: ContactFields & { id: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
  initialTemplate?: string;
}) {
  const { data: templates = [] } = useTemplates();
  const [mode, setMode] = useState<"message" | "share">("message");
  const [tplId, setTplId] = useState("default");
  const [msg, setMsg] = useState(initialTemplate ?? "");
  const [fields, setFields] = useState<ContactField[]>(SHAREABLE_FIELDS.filter((f) => contact[f]));
  const num = waNumber(contact);

  const body = useMemo(() => {
    if (mode === "share") return shareDetailsText(contact, fields);
    const tpl = msg || templates.find((t) => t.id === tplId)?.body || "";
    return renderTemplate(tpl, contact);
  }, [mode, msg, tplId, templates, contact, fields]);

  async function openWa() {
    const url = whatsappUrl(num, body);
    if (!url) return toast.error("This number can't be used for WhatsApp.");
    window.open(url, "_blank", "noopener");
    try {
      await recordWhatsApp(contact.id, num!, mode === "share" ? "details_shared" : "whatsapp_opened", body);
    } catch (e) {
      console.error(e);
    }
    toast.success("WhatsApp opened — send the message there.");
    onDone?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp {contact.full_name ?? ""}</DialogTitle>
          <DialogDescription>To {formatPhone(num)}. You'll send the message yourself in WhatsApp.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "message" | "share")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="message">Message</TabsTrigger>
            <TabsTrigger value="share">Share details</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "message" ? (
          <div className="space-y-3">
            <Select
              value={tplId}
              onValueChange={(v) => {
                setTplId(v);
                setMsg("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              rows={4}
              value={msg || templates.find((t) => t.id === tplId)?.body || ""}
              onChange={(e) => setMsg(e.target.value)}
              aria-label="Message template"
            />
            <p className="text-xs text-muted-foreground">Placeholders: {"{{name}} {{phone}} {{company}}"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {SHAREABLE_FIELDS.filter((f) => contact[f]).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={fields.includes(f)}
                  onCheckedChange={(c) => setFields((p) => (c ? [...p, f] : p.filter((x) => x !== f)))}
                />
                {FIELD_LABELS[f]}
              </label>
            ))}
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm">{body || "—"}</pre>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" disabled={!body} onClick={openWa}>
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
