import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { download, toCSV, toVCF, toXLSX } from "@/lib/contacts/export";
import { CONTACT_FIELDS, FIELD_LABELS, type Contact, type ContactField } from "@/lib/contacts/types";

const DEFAULT: ContactField[] = ["full_name", "phone", "whatsapp_phone", "email", "company", "job_title", "city", "state", "address", "notes"];

export function ExportDialog({ open, onOpenChange, load }: { open: boolean; onOpenChange: (o: boolean) => void; load: () => Promise<Contact[]> }) {
  const [fmt, setFmt] = useState<"xlsx" | "csv" | "vcf">("xlsx");
  const [fields, setFields] = useState<(ContactField | "tags")[]>([...DEFAULT, "tags"]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const rows = await load();
      const stamp = new Date().toISOString().slice(0, 10);
      if (fmt === "csv") download(toCSV(rows, fields), `contacts-${stamp}.csv`, "text/csv;charset=utf-8");
      else if (fmt === "vcf") download(toVCF(rows), `contacts-${stamp}.vcf`, "text/vcard");
      else download(toXLSX(rows, fields), `contacts-${stamp}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export contacts</DialogTitle>
          <DialogDescription>Phone numbers are kept as text, so leading zeros and + signs stay intact.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as typeof fmt)} className="flex gap-4">
          {(["xlsx", "csv", "vcf"] as const).map((f) => (
            <Label key={f} className="flex items-center gap-2">
              <RadioGroupItem value={f} /> {f === "vcf" ? "vCard" : f.toUpperCase()}
            </Label>
          ))}
        </RadioGroup>
        {fmt !== "vcf" && (
          <div className="grid grid-cols-2 gap-2">
            {[...CONTACT_FIELDS, "tags" as const].map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <Checkbox checked={fields.includes(f)} onCheckedChange={(c) => setFields((p) => (c ? [...p, f] : p.filter((x) => x !== f)))} />
                {f === "tags" ? "Tags" : FIELD_LABELS[f]}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={run} disabled={busy || (!fields.length && fmt !== "vcf")}>
            {busy ? "Preparing…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
