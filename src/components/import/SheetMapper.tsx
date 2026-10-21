import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { autoMapping } from "@/lib/contacts/spreadsheet";
import { CONTACT_FIELDS, FIELD_LABELS, type ContactField } from "@/lib/contacts/types";
import type { SheetFile } from "./useImportPipeline";

export type SheetSelection = { file: SheetFile; sheetIdx: number; mapping: (ContactField | null)[] };

export function SheetMapper({ files, onDone }: { files: SheetFile[]; onDone: (s: SheetSelection[]) => void }) {
  const [sel, setSel] = useState<Record<string, { on: boolean; mapping: (ContactField | null)[] }>>(() => {
    const o: Record<string, { on: boolean; mapping: (ContactField | null)[] }> = {};
    files.forEach((f, fi) => f.sheets.forEach((s, si) => (o[`${fi}:${si}`] = { on: true, mapping: autoMapping(s.headers) })));
    return o;
  });
  return (
    <div className="space-y-6">
      {files.map((f, fi) =>
        f.sheets.map((s, si) => {
          const k = `${fi}:${si}`;
          const st = sel[k];
          if (!st) return null;
          return (
            <div key={k} className="rounded-xl border bg-card">
              <label className="flex items-center gap-3 border-b px-4 py-3">
                <Checkbox checked={st.on} onCheckedChange={(c) => setSel((p) => ({ ...p, [k]: { ...st, on: !!c } }))} />
                <span className="font-medium">{f.name}</span>
                <span className="text-sm text-muted-foreground">· {s.name} · {s.rows.length} rows</span>
              </label>
              {st.on && (
                <div className="overflow-x-auto p-4">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        {s.headers.map((h, ci) => (
                          <th key={ci} className="min-w-36 p-1 text-left align-top">
                            <div className="mb-1 truncate text-xs text-muted-foreground">{h || `Column ${ci + 1}`}</div>
                            <Select
                              value={st.mapping[ci] ?? "skip"}
                              onValueChange={(v) => {
                                const m = [...st.mapping];
                                m[ci] = v === "skip" ? null : (v as ContactField);
                                setSel((p) => ({ ...p, [k]: { ...st, mapping: m } }));
                              }}
                            >
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">— Skip —</SelectItem>
                                {CONTACT_FIELDS.map((cf) => <SelectItem key={cf} value={cf}>{FIELD_LABELS[cf]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.slice(0, 5).map((r, ri) => (
                        <tr key={ri} className="border-t">
                          {s.headers.map((_, ci) => <td key={ci} className="max-w-48 truncate p-1">{r[ci]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }),
      )}
      <Button
        className="w-full"
        onClick={() =>
          onDone(
            Object.entries(sel)
              .filter(([, v]) => v.on && v.mapping.some(Boolean))
              .map(([k, v]) => {
                const [fi = 0, si = 0] = k.split(":").map(Number);
                return { file: files[fi]!, sheetIdx: si, mapping: v.mapping };
              }),
          )
        }
      >
        Continue to review
      </Button>
    </div>
  );
}
