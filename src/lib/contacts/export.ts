import * as XLSX from "xlsx";
import { FIELD_LABELS, type ContactField, type ContactFields } from "./types";

type Row = ContactFields & { tags?: string[] | null };

function cell(r: Row, f: ContactField | "tags"): string {
  if (f === "tags") return (r.tags ?? []).join(", ");
  return r[f] ?? "";
}

function label(f: ContactField | "tags") {
  return f === "tags" ? "Tags" : FIELD_LABELS[f];
}

function csvEscape(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV. Phones keep their leading "+" and are written as text, so Excel won't use scientific notation
 *  when the file is imported as text; the XLSX export is the safest for Excel. */
export function toCSV(rows: Row[], fields: (ContactField | "tags")[]): string {
  const head = fields.map((f) => csvEscape(label(f))).join(",");
  const body = rows.map((r) => fields.map((f) => csvEscape(cell(r, f))).join(","));
  return "\uFEFF" + [head, ...body].join("\r\n");
}

/** XLSX with every cell typed as string ("s") — phone numbers never become numbers. */
export function toXLSX(rows: Row[], fields: (ContactField | "tags")[]): ArrayBuffer {
  const aoa = [fields.map(label), ...rows.map((r) => fields.map((f) => cell(r, f)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false });
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue;
    const c = ws[addr] as XLSX.CellObject;
    c.t = "s";
    c.z = "@";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

function vEsc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function toVCF(rows: Row[]): string {
  return rows
    .map((r) => {
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      const fn = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company || r.phone || "";
      lines.push(`FN:${vEsc(fn)}`);
      lines.push(`N:${vEsc(r.last_name ?? "")};${vEsc(r.first_name ?? (r.last_name ? "" : fn))};;;`);
      if (r.phone) lines.push(`TEL;TYPE=CELL:${r.phone}`);
      if (r.secondary_phone) lines.push(`TEL;TYPE=VOICE:${r.secondary_phone}`);
      if (r.whatsapp_phone && r.whatsapp_phone !== r.phone) lines.push(`TEL;TYPE=CELL,WHATSAPP:${r.whatsapp_phone}`);
      if (r.email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(r.email)}`);
      if (r.secondary_email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(r.secondary_email)}`);
      if (r.company) lines.push(`ORG:${vEsc(r.company)}`);
      if (r.job_title) lines.push(`TITLE:${vEsc(r.job_title)}`);
      if (r.website) lines.push(`URL:${vEsc(r.website)}`);
      if (r.address || r.city || r.state || r.postal_code || r.country)
        lines.push(
          `ADR;TYPE=WORK:;;${vEsc(r.address ?? "")};${vEsc(r.city ?? "")};${vEsc(r.state ?? "")};${vEsc(r.postal_code ?? "")};${vEsc(r.country ?? "")}`,
        );
      if (r.notes) lines.push(`NOTE:${vEsc(r.notes)}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n");
}

export function download(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
