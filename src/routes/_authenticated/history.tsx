import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History as HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, headMeta } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => headMeta("Import History", "Every import with its results."),
  component: History,
});

function History() {
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => (await supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <div>
      <PageHeader title="Import History" />
      <div className="p-4 md:p-8">
        {jobs.data?.length ? (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th><th className="p-3">Source</th><th className="p-3">Status</th>
                  <th className="p-3 text-right">Detected</th><th className="p-3 text-right">Saved</th>
                  <th className="p-3 text-right">Duplicates</th><th className="p-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.data.map((j) => (
                  <tr key={j.id}>
                    <td className="whitespace-nowrap p-3">{format(new Date(j.created_at), "d MMM yyyy, p")}</td>
                    <td className="max-w-64 truncate p-3">{j.source_filename ?? j.source_type}</td>
                    <td className="p-3"><Badge variant={j.status === "completed" ? "default" : "secondary"}>{j.status}</Badge></td>
                    <td className="p-3 text-right">{j.total_records}</td>
                    <td className="p-3 text-right">{j.successful_records}</td>
                    <td className="p-3 text-right">{j.duplicate_records}</td>
                    <td className="p-3 text-right">{j.failed_records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={HistoryIcon} title="No imports yet" text="Your import sessions will appear here." />
        )}
      </div>
    </div>
  );
}
