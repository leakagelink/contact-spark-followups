import * as XLSX from "xlsx";
import type { ContactField } from "./types";

export type Sheet = { name: string; headers: string[]; rows: string[][] };

/** Read every worksheet as raw strings (raw: false keeps "0987..." and avoids 9.87E+09). */
export function readWorkbook(buf: ArrayBuffer): Sheet[] {
  const wb = XLSX.read(buf, { type: "array", raw: false, cellText: true, cellDates: false });
  return wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    const headerIdx = detectHeaderRow(aoa);
    const headers = (aoa[headerIdx] ?? []).map((h) => String(h ?? "").trim());
    const rows = aoa.slice(headerIdx + 1).map((r) => r.map((c) => String(c ?? "").trim()));
    return { name, headers, rows: rows.filter((r) => r.some(Boolean)) };
  }).filter((s) => s.headers.length || s.rows.length);
}

function detectHeaderRow(aoa: string[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const hits = (aoa[i] ?? []).filter((h) => guessField(String(h)) !== null).length;
    if (hits >= 2) return i;
  }
  return 0;
}

const SYNONYMS: [ContactField, RegExp][] = [
  ["whatsapp_phone", /whats\s*app|wa\s*(no|number)?$/i],
  ["secondary_phone", /(alt|alternate|secondary|other|landline|office)\s*(phone|mobile|no|number|contact)|phone\s*2|mobile\s*2|telephone/i],
  ["phone", /mobile|phone|cell|contact\s*(no|number)?|^tel|ph\.?\s*no|^number$|mob/i],
  ["secondary_email", /(alt|alternate|secondary|other)\s*e-?mail|e-?mail\s*2/i],
  ["email", /e-?mail|mail\s*id/i],
  ["first_name", /first\s*name|given\s*name|^fname/i],
  ["last_name", /last\s*name|surname|family\s*name|^lname/i],
  ["full_name", /^(full\s*)?name$|contact\s*(person|name)|customer|client|person|naam/i],
  ["company", /company|organi[sz]ation|firm|business|org$/i],
  ["job_title", /title|designation|position|role/i],
  ["postal_code", /pin\s*code|zip|postal|pincode/i],
  ["city", /city|town|district/i],
  ["state", /state|province|region/i],
  ["country", /country/i],
  ["address", /address|location|street|area/i],
  ["website", /web|url|site/i],
  ["notes", /note|remark|comment|description/i],
];

export function guessField(header: string): ContactField | null {
  const h = header.trim();
  if (!h) return null;
  for (const [f, re] of SYNONYMS) if (re.test(h)) return f;
  return null;
}

export function autoMapping(headers: string[]): (ContactField | null)[] {
  const used = new Set<ContactField>();
  return headers.map((h) => {
    const f = guessField(h);
    if (!f || used.has(f)) return null;
    used.add(f);
    return f;
  });
}
