import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_B64 = 20 * 1024 * 1024 * 1.37;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Input = { text?: string; file?: { base64: string; mime: string; name: string }; country: string };

export const extractContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Input) => {
    if (!i.text && !i.file) throw new Error("Nothing to extract");
    if (i.file) {
      if (!ALLOWED.includes(i.file.mime)) throw new Error(`Unsupported file type: ${i.file.mime}`);
      if (i.file.base64.length > MAX_B64) throw new Error("File is too large (max 20 MB)");
    }
    if (i.text && i.text.length > 200_000) throw new Error("Text is too long (max 200,000 characters)");
    return { ...i, country: /^[A-Z]{2}$/.test(i.country) ? i.country : "IN" };
  })
  .handler(async ({ data }) => {
    const { extractContactsWithAI, ExtractionError } = await import("./ai/extract.server");
    try {
      return { ok: true as const, ...(await extractContactsWithAI(data)) };
    } catch (e) {
      if (e instanceof ExtractionError) return { ok: false as const, error: e.message, status: e.status };
      throw e;
    }
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    for (const t of ["follow_up_tasks", "contact_activities", "import_records", "contacts", "import_jobs", "message_templates"] as const)
      await supabase.from(t).delete().eq("user_id", userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
