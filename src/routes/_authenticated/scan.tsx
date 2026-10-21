import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Contrast, ImagePlus, RotateCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PageHeader, headMeta } from "@/components/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => headMeta("Scan Document", "Scan visiting cards and documents with your camera."),
  component: ScanPage,
});

type Page = { src: Blob; rotate: number; enhance: boolean; crop: [number, number, number, number]; preview: string };

async function render(p: Page): Promise<Blob> {
  const bmp = await createImageBitmap(p.src);
  const [t, r, b, l] = p.crop;
  const sx = (bmp.width * l) / 100, sy = (bmp.height * t) / 100;
  const sw = bmp.width * (1 - (l + r) / 100), sh = bmp.height * (1 - (t + b) / 100);
  const rot = ((p.rotate % 360) + 360) % 360;
  const c = document.createElement("canvas");
  c.width = rot % 180 ? sh : sw;
  c.height = rot % 180 ? sw : sh;
  const ctx = c.getContext("2d")!;
  if (p.enhance) ctx.filter = "grayscale(1) contrast(1.6) brightness(1.08)";
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bmp, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return new Promise((res) => c.toBlob((x) => res(x!), "image/jpeg", 0.92));
}

function ScanPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [input, setInput] = useState<{ scanImages: Blob[] } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  async function addBlob(b: Blob) {
    const p: Page = { src: b, rotate: 0, enhance: false, crop: [0, 0, 0, 0], preview: "" };
    p.preview = URL.createObjectURL(await render(p));
    setPages((x) => [...x, p]);
  }
  async function update(i: number, patch: Partial<Page>) {
    const cur = pages[i];
    if (!cur) return;
    const p: Page = { ...cur, ...patch };
    p.preview = URL.createObjectURL(await render(p));
    setPages((x) => x.map((y, j) => (j === i ? p : y)));
  }

  async function startCam() {
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Live camera isn't available here. Use “Take photo / Gallery” instead.");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } });
      setCamOn(true);
    } catch {
      toast.error("Camera permission was denied. Use “Take photo / Gallery” instead.");
    }
  }
  useEffect(() => {
    if (camOn && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camOn]);
  const stopCam = () => { stream.current?.getTracks().forEach((t) => t.stop()); setCamOn(false); };
  useEffect(() => stopCam, []);

  function capture() {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && addBlob(b), "image/jpeg", 0.95);
  }

  if (input) return (
    <div><PageHeader title="Scan Document" /><div className="mx-auto max-w-5xl p-4 md:p-8"><ImportWizard input={input} onReset={() => { setInput(null); setPages([]); }} /></div></div>
  );

  const e = edit != null ? pages[edit] : null;
  return (
    <div>
      <PageHeader title="Scan Document" description="Capture visiting cards or pages. Add several, then extract." />
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
        {camOn ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <video ref={video} autoPlay playsInline muted className="aspect-[3/4] w-full bg-foreground object-cover md:aspect-video" />
            <div className="flex gap-2 p-3">
              <Button size="lg" className="flex-1" onClick={capture}><Camera className="h-5 w-5" /> Capture</Button>
              <Button size="lg" variant="outline" onClick={stopCam}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="h-24 flex-col" onClick={startCam}><Camera className="h-6 w-6" /> Live camera</Button>
            <Button size="lg" variant="outline" className="h-24 flex-col" asChild>
              <label>
                <ImagePlus className="h-6 w-6" /> Take photo / Gallery
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only"
                  onChange={(ev) => { [...(ev.target.files ?? [])].forEach(addBlob); ev.target.value = ""; }} />
              </label>
            </Button>
          </div>
        )}

        {pages.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pages.map((p, i) => (
              <button key={i} onClick={() => setEdit(i)} className={`relative overflow-hidden rounded-lg border bg-card ${edit === i ? "ring-2 ring-primary" : ""}`}>
                <img src={p.preview} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-card px-1.5 text-xs">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        {e && edit != null && (
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Page {edit + 1}</h3>
              <Button size="icon" variant="ghost" aria-label="Close editor" onClick={() => setEdit(null)}><X className="h-4 w-4" /></Button>
            </div>
            <img src={e.preview} alt="Preview" className="max-h-96 w-full rounded-lg object-contain" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => update(edit, { rotate: e.rotate + 90 })}><RotateCw className="h-4 w-4" /> Rotate</Button>
              <Button variant={e.enhance ? "default" : "outline"} onClick={() => update(edit, { enhance: !e.enhance })}><Contrast className="h-4 w-4" /> Improve contrast</Button>
              <Button variant="ghost" className="text-destructive" onClick={() => { setPages((x) => x.filter((_, j) => j !== edit)); setEdit(null); }}><Trash2 className="h-4 w-4" /> Remove</Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(["Top", "Right", "Bottom", "Left"] as const).map((lbl, k) => (
                <label key={lbl} className="space-y-2">
                  <span className="text-xs text-muted-foreground">Crop {lbl.toLowerCase()} {e.crop[k] ?? 0}%</span>
                  <Slider min={0} max={40} step={1} value={[e.crop[k] ?? 0]} onValueCommit={([v = 0]) => { const c = [...e.crop] as Page["crop"]; c[k] = v; update(edit, { crop: c }); }} />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Automatic perspective correction isn't available in the browser — hold the camera straight above the card for best results.</p>
          </div>
        )}

        <Button size="lg" className="w-full" disabled={!pages.length} onClick={async () => { stopCam(); setInput({ scanImages: await Promise.all(pages.map(render)) }); }}>
          Extract contacts from {pages.length} image{pages.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
