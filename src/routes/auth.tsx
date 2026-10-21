import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/contacts/types";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Sign in — ${APP_NAME}` },
      { name: "description", content: `Sign in or create your ${APP_NAME} account.` },
      { property: "og:title", content: `Sign in — ${APP_NAME}` },
      { property: "og:description", content: `Sign in or create your ${APP_NAME} account.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/dashboard", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/dashboard", replace: true }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }


  async function forgot() {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? "Welcome back" : "Create your account"}</p>
        {sent ? (
          <p className="mt-6 rounded-lg bg-accent p-4 text-sm text-accent-foreground">
            Check your email to confirm your account, then come back and sign in.
          </p>
        ) : (
          <>
            <form onSubmit={submit} className="mt-6 space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <div className="mt-4 flex justify-between text-sm">
              <button className="text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create account" : "Have an account? Sign in"}
              </button>
              {mode === "signin" && (
                <button className="text-muted-foreground hover:underline" onClick={forgot}>
                  Forgot password?
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
