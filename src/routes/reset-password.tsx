import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — ContactFlow AI" },
      { name: "description", content: "Set a new password for your account." },
      { property: "og:title", content: "Reset password — ContactFlow AI" },
      { property: "og:description", content: "Set a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={save} className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-8">
        <h1 className="text-xl font-bold">Set a new password</h1>
        <Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
        <Button className="w-full" type="submit">Save password</Button>
      </form>
    </div>
  );
}
