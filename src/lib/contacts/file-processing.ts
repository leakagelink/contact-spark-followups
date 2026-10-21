export type FileKind = "image" | "pdf" | "spreadsheet" | "docx" | "doc" | "text" | "unsupported";

export const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,image/jpeg,image/png,image/webp,application/pdf";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function classify(file: File): FileKind {
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|webp)$/.test(n) || ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "image";
  if (n.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (/\.(xlsx|xls|csv)$/.test(n)) return "spreadsheet";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (n.endsWith(".txt") || file.type.startsWith("text/")) return "text";
  return "unsupported";
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Downscale large photos before upload: faster, cheaper and still legible for OCR. */
export async function imageToJpegBase64(src: Blob, maxSide = 2200): Promise<string> {
  const bmp = await createImageBitmap(src);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
  return arrayBufferToBase64(await blob.arrayBuffer());
}

export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")).default;
  // HTML keeps table cells separated; strip tags into tab/line separated text.
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return value
    .replace(/<\/(td|th)>/g, "\t")
    .replace(/<\/(p|tr|li|h\d)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split long text on line boundaries so each AI call stays manageable. */
export function chunkText(text: string, max = 12000): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur.length + line.length + 1 > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export const yieldToUI = () => new Promise((r) => setTimeout(r, 0));
