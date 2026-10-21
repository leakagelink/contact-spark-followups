import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATE } from "@/lib/contacts/whatsapp";

export type Template = { id: string; name: string; body: string };

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<Template[]> => {
      const { data } = await supabase.from("message_templates").select("id,name,body").order("created_at");
      return [{ id: "default", name: "Call follow-up (default)", body: DEFAULT_TEMPLATE }, ...(data ?? [])];
    },
  });
}
