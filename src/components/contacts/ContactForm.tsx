import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FIELD_LABELS, type ContactField, type ContactFields } from "@/lib/contacts/types";
import type { Issue } from "@/lib/contacts/validation";

const LAYOUT: ContactField[] = [
  "full_name",
  "company",
  "phone",
  "whatsapp_phone",
  "secondary_phone",
  "email",
  "secondary_email",
  "job_title",
  "website",
  "address",
  "city",
  "state",
  "postal_code",
  "country",
];

export function ContactForm({
  value,
  onChange,
  issues = [],
  ambiguous = [],
  compact,
}: {
  value: ContactFields;
  onChange: (v: ContactFields) => void;
  issues?: Issue[];
  ambiguous?: ContactField[];
  compact?: boolean;
}) {
  const fields = compact ? LAYOUT.slice(0, 9) : LAYOUT;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const err = issues.find((i) => i.field === f && i.blocking);
        const warn = ambiguous.includes(f);
        return (
          <div key={f} className={cn(f === "address" && "sm:col-span-2")}>
            <Label htmlFor={f} className="text-xs">
              {FIELD_LABELS[f]} {warn && <span className="text-warning-foreground">· check</span>}
            </Label>
            <Input
              id={f}
              value={value[f] ?? ""}
              inputMode={f.includes("phone") ? "tel" : f.includes("email") ? "email" : undefined}
              aria-invalid={!!err}
              className={cn(err && "border-destructive", warn && !err && "border-warning bg-warning/10")}
              onChange={(e) => onChange({ ...value, [f]: e.target.value || null })}
            />
            {err && <p className="mt-1 text-xs text-destructive">{err.message}</p>}
          </div>
        );
      })}
      {!compact && (
        <div className="sm:col-span-2">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <Textarea id="notes" value={value.notes ?? ""} onChange={(e) => onChange({ ...value, notes: e.target.value || null })} />
        </div>
      )}
    </div>
  );
}
