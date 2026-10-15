"use client";
import { useState } from "react";
import { generateWord, buildWordBlobs, safeName, type WordCtx } from "@/lib/word";
import { downloadZip } from "@/lib/zip";

const ITEMS: [string, string][] = [
  ["tested", "Financiero de la parte analizada"],
  ["fin", "Estados financieros comparables"],
  ["listado", "Listado de aceptadas"],
  ["desc", "Descripción de aceptadas"],
  ["rech", "Razones de rechazo (con embudo)"],
];

export function WordModal({
  open, onClose, ctx, buildPipeline,
}: {
  open: boolean; onClose: () => void; ctx: WordCtx;
  buildPipeline?: () => Blob | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; txt: string } | null>(null);
  if (!open) return null;

  const noName = !ctx.testedName.trim();

  // descarga individual de un anexo (sin zip)
  const run = async (kind: string) => {
    if (noName) return;
    setBusy(kind); setNote(null);
    try {
      await generateWord(kind, ctx);
      setNote({ ok: true, txt: "Informe generado." });
    } catch (e) {
      setNote({ ok: false, txt: "No se pudo generar: " + (e instanceof Error ? e.message : String(e)) });
    } finally { setBusy(null); }
  };

  // informe completo: 5 Word + pipeline_output.xlsx, todo en un .zip
  const runZip = async () => {
    if (noName) return;
    setBusy("all"); setNote(null);
    try {
      const files = await buildWordBlobs(ctx);
      const pipe = buildPipeline?.();
      if (pipe) files.push({ name: "pipeline_output.xlsx", blob: pipe });
      await downloadZip(files, `informe_${safeName(ctx.testedName)}.zip`);
      setNote({ ok: true, txt: pipe ? "Listo: .zip con los 5 informes + el pipeline_output." : "Listo: .zip con los 5 informes." });
    } catch (e) {
      setNote({ ok: false, txt: "No se pudo generar: " + (e instanceof Error ? e.message : String(e)) });
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="display text-[20px] font-semibold">Informes Word</h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              Empresa analizada: <b>{ctx.testedName || "sin nombre"}</b> · se generan en tu navegador.
            </p>
          </div>
          <button onClick={onClose} className="text-[18px] text-ink-soft hover:text-ink">✕</button>
        </div>
        {noName && (
          <p className="mt-3 rounded-lg border-l-2 border-warn bg-warn-tint px-3 py-2.5 text-[13px] text-warn">
            Cargá el <b>nombre de la parte analizada</b> (en la barra de export) para poder descargar. Se agrega al nombre de cada archivo.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2">
          {ITEMS.map(([k, label]) => (
            <button key={k} disabled={!!busy || noName} onClick={() => run(k)}
              className="flex items-center justify-between rounded-lg border border-line-strong px-4 py-2.5 text-left text-[14px] transition hover:border-accent disabled:opacity-40 disabled:hover:border-line-strong">
              <span>{label}</span>
              {busy === k && <span className="text-[12px] text-ink-soft">generando…</span>}
            </button>
          ))}
          <button disabled={!!busy || noName} onClick={runZip}
            className="mt-1 flex items-center justify-between rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium text-paper transition hover:opacity-90 disabled:opacity-40">
            <span>Descargar todo en .zip (5 Word + pipeline_output)</span>
            {busy === "all" && <span className="text-[12px] opacity-80">armando…</span>}
          </button>
        </div>
        {note && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${note.ok ? "bg-accent-tint text-accent" : "bg-warn-tint text-warn"}`}>{note.txt}</p>
        )}
      </div>
    </div>
  );
}
