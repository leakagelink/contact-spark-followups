import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { extractContacts } from "@/lib/extract.functions";
import { arrayBufferToBase64, chunkText, classify, docxToText, imageToJpegBase64, MAX_FILE_BYTES, yieldToUI } from "@/lib/contacts/file-processing";
import { draftsFromAI } from "@/lib/contacts/postprocess";
import { readWorkbook, type Sheet } from "@/lib/contacts/spreadsheet";
import { findEmails, findPhones } from "@/lib/contacts/phone";
import type { ContactDraft, SourceType } from "@/lib/contacts/types";

export type FileProgress = { name: string; status: "queued" | "processing" | "done" | "failed"; found: number; error?: string };
export type SheetFile = { name: string; sourceType: SourceType; sheets: Sheet[] };

/** Runs every input through OCR/AI or deterministic parsing and returns drafts for review. */
export function useImportPipeline(country: CountryCode) {
  const extract = useServerFn(extractContacts);
  const [progress, setProgress] = useState<FileProgress[]>([]);
  const cancelled = useRef(false);

  const set = (i: number, p: Partial<FileProgress>) => setProgress((prev) => prev.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const callAI = useCallback(
    async (data: Parameters<typeof extract>[0]["data"]) => {
      const r = await extract({ data });
      if (!r.ok) throw new Error(r.error);
      return r.contacts;
    },
    [extract],
  );

  /** Extraction for text: AI first; if the AI is unavailable, fall back to regex-only partial contacts. */
  const fromText = useCallback(
    async (text: string, sourceType: SourceType, filename: string | null): Promise<{ drafts: ContactDraft[]; warning?: string }> => {
      const drafts: ContactDraft[] = [];
      try {
        for (const chunk of chunkText(text)) {
          if (cancelled.current) break;
          const recs = await callAI({ text: chunk, country });
          drafts.push(...draftsFromAI(recs, { sourceText: chunk, country, sourceFilename: filename, sourceType }));
        }
        return { drafts };
      } catch (e) {
        const phones = findPhones(text, country);
        const emails = findEmails(text);
        if (!phones.length && !emails.length) throw e;
        return {
          drafts: draftsFromAI([], { sourceText: text, country, sourceFilename: filename, sourceType }),
          warning: `${(e as Error).message} Showing numbers and emails found by pattern matching only — names were not detected.`,
        };
      }
    },
    [callAI, country],
  );

  const run = useCallback(
    async (input: { files?: File[]; text?: string; scanImages?: Blob[] }) => {
      cancelled.current = false;
      const items: { name: string; work: () => Promise<{ drafts?: ContactDraft[]; sheet?: SheetFile; warning?: string }> }[] = [];

      if (input.text?.trim()) items.push({ name: "Pasted text", work: () => fromText(input.text!, "text", null) });

      input.scanImages?.forEach((b, i) =>
        items.push({
          name: `Scan page ${i + 1}`,
          work: async () => {
            const base64 = await imageToJpegBase64(b);
            const recs = await callAI({ file: { base64, mime: "image/jpeg", name: `scan-${i + 1}.jpg` }, country });
            return { drafts: draftsFromAI(recs, { country, sourceFilename: `Scan ${new Date().toLocaleString()}`, sourceType: "scan", defaultLocation: `Page ${i + 1}` }) };
          },
        }),
      );

      for (const file of input.files ?? []) {
        const kind = classify(file);
        items.push({
          name: file.name,
          work: async () => {
            if (file.size > MAX_FILE_BYTES) throw new Error("File is larger than 20 MB");
            if (file.size === 0) throw new Error("File is empty");
            switch (kind) {
              case "image": {
                const base64 = await imageToJpegBase64(file);
                const recs = await callAI({ file: { base64, mime: "image/jpeg", name: file.name }, country });
                return { drafts: draftsFromAI(recs, { country, sourceFilename: file.name, sourceType: "image" }) };
              }
              case "pdf": {
                const base64 = arrayBufferToBase64(await file.arrayBuffer());
                const recs = await callAI({ file: { base64, mime: "application/pdf", name: file.name }, country });
                return { drafts: draftsFromAI(recs, { country, sourceFilename: file.name, sourceType: "pdf" }) };
              }
              case "spreadsheet": {
                const sheets = readWorkbook(await file.arrayBuffer());
                if (!sheets.length) throw new Error("No data found in this file");
                return { sheet: { name: file.name, sourceType: file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel", sheets } };
              }
              case "docx": {
                const text = await docxToText(await file.arrayBuffer());
                if (!text.trim()) throw new Error("No text found in this document");
                return fromText(text, "word", file.name);
              }
              case "text":
                return fromText(await file.text(), "text", file.name);
              case "doc":
                throw new Error("Old .doc files aren't supported. Open it in Word or Google Docs and save as .docx, then import again.");
              default:
                throw new Error("Unsupported file type");
            }
          },
        });
      }

      setProgress(items.map((i) => ({ name: i.name, status: "queued", found: 0 })));
      const drafts: ContactDraft[] = [];
      const sheets: SheetFile[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < items.length; i++) {
        if (cancelled.current) break;
        set(i, { status: "processing" });
        await yieldToUI();
        try {
          const r = await items[i].work();
          if (r.drafts) drafts.push(...r.drafts);
          if (r.sheet) sheets.push(r.sheet);
          if (r.warning) warnings.push(`${items[i].name}: ${r.warning}`);
          set(i, { status: "done", found: r.drafts?.length ?? r.sheet?.sheets.reduce((a, s) => a + s.rows.length, 0) ?? 0, error: r.warning });
        } catch (e) {
          set(i, { status: "failed", error: (e as Error).message });
        }
      }
      return { drafts, sheets, warnings, failed: 0 };
    },
    [callAI, country, fromText],
  );

  return { run, progress, cancel: () => (cancelled.current = true) };
}
