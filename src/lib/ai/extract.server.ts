import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = process.env["CONTACT_EXTRACTION_MODEL"] || "openai/gpt-6-astra";

const nul = z.string().nullable();
export const aiContactSchema = z.object({
  contacts: z.array(
    z.object({
      full_name: nul,
      first_name: nul,
      last_name: nul,
      phone: nul,
      secondary_phone: nul,
      whatsapp_phone: nul,
      email: nul,
      secondary_email: nul,
      address: nul,
      city: nul,
      state: nul,
      country: nul,
      postal_code: nul,
      company: nul,
      job_title: nul,
      website: nul,
      notes: nul,
      source_location: nul,
      confidence: z.number(),
      ambiguous_fields: z.array(z.string()),
    }),
  ),
});
export type AiContacts = z.infer<typeof aiContactSchema>;

const INSTRUCTIONS = `You extract contact records from documents, visiting cards, screenshots, lists and pasted text.
Rules:
- Return one record per distinct person or business. A list of 50 people yields 50 records.
- Copy values exactly as they appear. NEVER invent, guess or complete names, numbers, emails or addresses. Use null for anything not present.
- phone = primary mobile number; secondary_phone = other/landline numbers. Keep the digits exactly as written including country code if shown.
- whatsapp_phone only if the source explicitly marks a number as WhatsApp; otherwise null.
- Split full_name into first_name/last_name only when obvious.
- source_location: page number ("Page 2") or region if determinable, else null.
- confidence: 0..1 for how sure you are the record is read correctly (lower for blurry/handwritten text).
- ambiguous_fields: names of fields that may be misread or unclear.
- If there are no contacts, return an empty list.`;

export class ExtractionError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

export async function extractContactsWithAI(input: {
  text?: string;
  file?: { base64: string; mime: string; name: string };
  country: string;
}): Promise<AiContacts> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new ExtractionError("AI extraction is not configured (missing LOVABLE_API_KEY).", 500);

  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const content: Exclude<ModelMessage["content"], string> = [
    { type: "text", text: `Default country for numbers without a country code: ${input.country}. Extract all contacts.` },
  ] as never;
  if (input.text) (content as unknown[]).push({ type: "text", text: input.text.slice(0, 120_000) });
  if (input.file) {
    if (input.file.mime === "application/pdf")
      (content as unknown[]).push({ type: "file", filename: input.file.name, data: input.file.base64, mediaType: "application/pdf" });
    else
      (content as unknown[]).push({ type: "image", image: new URL(`data:${input.file.mime};base64,${input.file.base64}`) });
  }

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content } as ModelMessage],
      output: Output.object({ schema: aiContactSchema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    return (await result.output) as AiContacts;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      try {
        return aiContactSchema.parse(JSON.parse(err.text ?? ""));
      } catch {
        throw new ExtractionError("The AI returned an unreadable answer. Please try again.", 502);
      }
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 402) throw new ExtractionError("AI credits are used up. Add credits in Settings → Plans & credits.", 402);
    if (status === 429) throw new ExtractionError("Too many requests right now — wait a moment and retry.", 429);
    if (status === 403) throw new ExtractionError("AI access is blocked for this workspace.", 403);
    console.error(err);
    throw new ExtractionError("Extraction failed. Please try again.", 500);
  }
}
