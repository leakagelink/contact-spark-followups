import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileSpreadsheet, MessageCircle, Phone, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/contacts/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Extract contacts from any document` },
      {
        name: "description",
        content: "Extract contacts from images, PDFs, Excel, Word and text. Import them in seconds. Call and follow up on WhatsApp.",
      },
      { property: "og:title", content: `${APP_NAME} — Extract contacts from any document` },
      { property: "og:description", content: "Import contacts in seconds, call and follow up on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const features = [
    { icon: ScanLine, title: "Scan & OCR", text: "Visiting cards, screenshots, scanned PDFs and printed lists." },
    { icon: FileSpreadsheet, title: "Any file", text: "Excel, CSV, Word, PDF and pasted text — many files at once." },
    { icon: Sparkles, title: "Review first", text: "Edit, fix invalid numbers and resolve duplicates before importing." },
    { icon: Phone, title: "One-tap call", text: "Open your dialer and get a follow-up prompt when you return." },
    { icon: MessageCircle, title: "WhatsApp follow-up", text: "Templates, previews and a one-at-a-time bulk queue." },
    { icon: ShieldCheck, title: "Private by default", text: "Only you can see your contacts." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-lg font-bold">{APP_NAME}</span>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            Contact importer & follow-up CRM
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Extract contacts from any document. Import them in seconds.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">Then call and follow up on WhatsApp — all from one place.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Get started free</Link>
            </Button>
          </div>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
