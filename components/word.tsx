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
  open, onClose, ctx, buildPipeline, buildChart, extraMargins, setExtraMargins,
}: {
  open: boolean; onClose: () => void; ctx: WordCtx;
  buildPipeline?: () => Blob | null;
  buildChart?: () => Promise<Blob | null>;
  extraMargins: { label: string; pct: string }[];
  setExtraMargins: (v: { label: string; pct: string }[]) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; txt: string } | null>(null);
  if (!open) return null;

  const noName = !ctx.testedName.trim();

  const addMargin = () => setExtraMargins([...extraMargins, { label: "", pct: "" }]);
  const updMargin = (i: number, k: "label" | "pct", v: string) =>
    setExtraMargins(extraMargins.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const rmMargin = (i: number) => setExtraMargins(extraMargins.filter((_, j) => j !== i));

  const dl = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // descarga individual de un anexo Word (sin zip)
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

  // solo el Excel con el cuadro PLI (sin zip, para tenerlo a mano)
  const runExcel = () => {
    setBusy("excel"); setNote(null);
    try {
      const pipe = buildPipeline?.();
      if (!pipe) { setNote({ ok: false, txt: "No hay datos para el cuadro PLI." }); return; }
      dl(pipe, `cuadro_pli_${safeName(ctx.testedName || "tested")}.xlsx`);
      setNote({ ok: true, txt: "Excel del cuadro PLI descargado." });
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
      if (pipe) files.push({ name: "cuadro_pli.xlsx", blob: pipe });
      const png = buildChart ? await buildChart() : null;
      if (png) files.push({ name: "grafico_rango.png", blob: png });
      await downloadZip(files, `archivos_${safeName(ctx.testedName)}.zip`);
      setNote({ ok: true, txt: "Listo: .zip con los 5 Word + cuadro PLI + gráfico." });
    } catch (e) {
      setNote({ ok: false, txt: "No se pudo generar: " + (e instanceof Error ? e.message : String(e)) });
    } finally { setBusy(null); }
  };

  const inputCls = "rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
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
            Cargá el <b>nombre de la parte analizada</b> (en la barra de export) para poder descargar los Word. Se agrega al nombre de cada archivo.
          </p>
        )}

        {/* Márgenes adicionales de la parte analizada (para el cuadro PLI) */}
        <div className="mt-4 rounded-lg border border-line-strong p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Márgenes de la parte analizada (cuadro PLI)</span>
            <button onClick={addMargin} className="text-[12.5px] font-medium text-accent">+ agregar</button>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">
            El margen principal (<b>{ctx.testedName || "—"}</b>) ya va solo. Sumá acá transacciones extra, ej. «Importaciones desde Vinculadas».
          </p>
          {extraMargins.map((m, i) => (
            <div key={i} className="mt-2 flex items-center gap-2">
              <input value={m.label} onChange={(e) => updMargin(i, "label", e.target.value)}
                placeholder="Etiqueta (ej. Helacor – Importaciones desde Vinculadas)"
                className={`${inputCls} flex-1`} />
              <input value={m.pct} onChange={(e) => updMargin(i, "pct", e.target.value)}
                placeholder="%" className={`${inputCls} w-16 text-right`} />
              <button onClick={() => rmMargin(i)} className="px-1 text-[16px] text-ink-soft hover:text-warn">✕</button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          {ITEMS.map(([k, label]) => (
            <button key={k} disabled={!!busy || noName} onClick={() => run(k)}
              className="flex items-center justify-between rounded-lg border border-line-strong px-4 py-2.5 text-left text-[14px] transition hover:border-accent disabled:opacity-40 disabled:hover:border-line-strong">
              <span>{label}</span>
              {busy === k && <span className="text-[12px] text-ink-soft">generando…</span>}
            </button>
          ))}
          <button disabled={!!busy} onClick={runExcel}
            className="flex items-center justify-between rounded-lg border border-line-strong px-4 py-2.5 text-left text-[14px] transition hover:border-accent disabled:opacity-40 disabled:hover:border-line-strong">
            <span>Descargar solo el Excel (cuadro PLI)</span>
            {busy === "excel" && <span className="text-[12px] text-ink-soft">generando…</span>}
          </button>
          <button disabled={!!busy || noName} onClick={runZip}
            className="mt-1 flex items-center justify-between rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium text-paper transition hover:opacity-90 disabled:opacity-40">
            <span>Descargar todo en .zip (5 Word + cuadro PLI + gráfico)</span>
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
