"use client";
import { fmtPct } from "@/lib/format";
import type { RangeStats } from "@/lib/engine";
import { UploadCloud } from "lucide-react";

export function Header({ onReset }: { onReset?: () => void }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1120px] items-baseline gap-4 px-6 py-5 md:px-10">
        <span className="display text-[26px] font-semibold leading-none tracking-tight">
          compar<span className="text-accent">.ar</span>
        </span>
        <span className="text-[13px] text-ink-soft">rango de tus comparables</span>
        <div className="flex-1" />
        {onReset && (
          <button
            onClick={onReset}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-soft hover:text-ink"
          >
            Otro archivo
          </button>
        )}
      </div>
    </header>
  );
}

export function UploadZone({ onFile, onSample }: { onFile: (f: File) => void; onSample: () => void }) {
  return (
    <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-10">
      <h1 className="display max-w-[18ch] text-[clamp(34px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em]">
        Motor de búsqueda interno
        <span className="text-ink-soft"> · versión 2</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-ink-soft">
        Si ya aceptaste y rechazaste a las empresas de la hoja MR, subí ese Excel para calcular
        los rangos —no ajustados y, si aplica, ajustados— sin salir de acá.
      </p>

      <div
        className="mt-9 flex flex-col items-start rounded-2xl border border-dashed border-line-strong bg-panel p-8 shadow-card transition hover:border-accent"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-tint text-accent">
            <UploadCloud size={20} />
          </span>
          <div>
            <div className="font-medium">El archivo <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[13px]">pipeline_output</code> de la etapa 1, arrastralo acá.</div>
            <div className="text-[13.5px] text-ink-soft">Con la columna Aceptada (Si/No) completada en la hoja MR.</div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <label
            htmlFor="fileInput"
            className="cursor-pointer rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-paper transition hover:opacity-90"
          >
            Elegir archivo
          </label>
          <button type="button" onClick={onSample} className="text-[14px] font-medium text-accent underline underline-offset-4">
            Probar con datos de ejemplo
          </button>
          <input
            id="fileInput"
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-ink-soft">
        Formato <code className="font-mono">.xlsx</code> · se procesa en tu equipo, no se sube a ningún servidor.
      </p>
    </div>
  );
}

export function ExportBar({ minmax, setMinmax, onExcel, onPng }: {
  minmax: boolean; setMinmax: (v: boolean) => void; onExcel: () => void; onPng: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-card">
      <button onClick={onExcel} className="rounded-lg bg-ink px-3.5 py-2 text-[13.5px] font-medium text-paper transition hover:opacity-90">
        Descargar Excel
      </button>
      <button onClick={onPng} className="rounded-lg border border-line-strong px-3.5 py-2 text-[13.5px] font-medium text-ink transition hover:border-accent">
        Descargar gráfico (PNG)
      </button>
      <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-soft">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={minmax} onChange={(e) => setMinmax(e.target.checked)} />
        Incluir mínimo y máximo en el gráfico
      </label>
    </div>
  );
}

export function RangeCards({ r }: { r: RangeStats }) {
  const cell = (label: string, value: string, strong = false) => (
    <div className={`rounded-2xl border border-line p-6 ${strong ? "bg-accent-tint" : "bg-panel"}`}>
      <div className="text-[13px] text-ink-soft">{label}</div>
      <div className={`display tnum mt-1 text-[40px] font-semibold leading-none ${strong ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {cell("Cuartil inferior (Q1)", fmtPct(r.q1))}
      {cell("Mediana", fmtPct(r.med), true)}
      {cell("Cuartil superior (Q3)", fmtPct(r.q3))}
    </div>
  );
}
