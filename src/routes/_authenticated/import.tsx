import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardPaste, FileUp, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, headMeta } from "@/components/PageHeader";
import { ImportWizard, StepBar } from "@/components/import/ImportWizard";
import { ACCEPT, classify } from "@/lib/contacts/file-processing";

export const Route = createFileRoute("/_authenticated/import")({
  validateSearch: z.object({ tab: z.enum(["files", "paste"]).optional() }),
  head: () => headMeta("Import Center", "Import contacts from images, PDFs, Excel, CSV, Word or pasted text."),
  component: ImportPage,
});

function ImportPage() {
  const { tab } = Route.useSearch();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [input, setInput] = useState<{ files?: File[]; text?: string } | null>(null);
  const [drag, setDrag] = useState(false);

  function add(list: FileList | null) {
    const arr = [...(list ?? [])];
    const bad = arr.filter((f) => classify(f) === "unsupported");
    if (bad.length) toast.error(`Unsupported: ${bad.map((b) => b.name).join(", ")}`);
    setFiles((p) => [...p, ...arr.filter((f) => classify(f) !== "unsupported")]);
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return toast.info("Clipboard is empty");
      setText((p) => (p ? p + "\n" : "") + t);
    } catch {
      toast.error("Clipboard access was blocked — paste with Ctrl+V / long-press instead.");
    }
  }

  return (
    <div>
      <PageHeader title="Import Center" description="Images, PDFs, Excel, CSV, Word and text — reviewed before anything is saved." />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
        {input ? (
          <ImportWizard input={input} onReset={() => { setInput(null); setFiles([]); setText(""); }} />
        ) : (
          <>
            <StepBar current={files.length || text ? 1 : 0} />
            <Tabs defaultValue={tab ?? "files"}>
              <TabsList>
                <TabsTrigger value="files"><FileUp className="mr-1 h-4 w-4" /> Files</TabsTrigger>
                <TabsTrigger value="paste"><ClipboardPaste className="mr-1 h-4 w-4" /> Paste text</TabsTrigger>
                <TabsTrigger value="scan" asChild><Link to="/scan"><ScanLine className="mr-1 h-4 w-4" /> Scan</Link></TabsTrigger>
              </TabsList>
              <TabsContent value="files" className="space-y-4">
                <label
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
                  className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center ${drag ? "border-primary bg-accent" : ""}`}
                >
                  <FileUp className="h-10 w-10 text-primary" />
                  <span className="mt-3 font-semibold">Drop files or tap to choose</span>
                  <span className="mt-1 text-sm text-muted-foreground">JPG, PNG, WEBP, PDF, XLSX, XLS, CSV, DOCX, TXT · up to 20 MB each · many at once</span>
                  <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
                </label>
                {files.length > 0 && (
                  <ul className="divide-y rounded-xl border bg-card text-sm">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between px-4 py-2">
                        <span className="truncate">{f.name}</span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {classify(f)} · {(f.size / 1024).toFixed(0)} KB
                          <Button size="icon" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button size="lg" className="w-full" disabled={!files.length} onClick={() => setInput({ files })}>
                  Extract contacts from {files.length || ""} file{files.length === 1 ? "" : "s"}
                </Button>
              </TabsContent>
              <TabsContent value="paste" className="space-y-3">
                <Textarea
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"Rahul Sharma, +91 9876543210, rahul@example.com, Indore\nPriya Verma, 9123456780, priya@example.com, Bhopal"}
                  aria-label="Text containing contacts"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={paste}><ClipboardPaste className="h-4 w-4" /> Paste from clipboard</Button>
                  <Button className="flex-1" disabled={!text.trim()} onClick={() => setInput({ text })}>Extract contacts</Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
