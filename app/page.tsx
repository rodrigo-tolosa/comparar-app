"use client";
import { useMemo, useState } from "react";
import { Header, UploadZone, RangeCards, ExportBar } from "@/components/ui";
import { RangeChart, ComparablesTable } from "@/components/charts";
import { RejectedPanel } from "@/components/rejected";
import { WordModal } from "@/components/word";
import type { WordCtx } from "@/lib/word";
import { TestedPanel, seedAdj, emptyAdj, deriveTP, type AdjState } from "@/components/tested";
import { parseWorkbook, loadSample, type Dataset } from "@/lib/parse";
import { computeRange, computeAdjustedRange, testedIndicator } from "@/lib/engine";
import { exportExcel, exportChartPNG } from "@/lib/export";

export default function Home() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [pli, setPli] = useState<string>("");
  const [ny, setNy] = useState(3);
  const [adj, setAdj] = useState<AdjState>(emptyAdj());
  const [anul, setAnul] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [minmax, setMinmax] = useState(true);
  const [testedName, setTestedName] = useState("");
  const [wordOpen, setWordOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function open(d: Dataset) {
    const first = Object.keys(d.plis)[0];
    if (!first) { setErr("No encontré columnas de PLI (formato «Margen …_AAAA») en la hoja PLI + Ratios."); return; }
    setErr(null); setDs(d); setPli(first); setNy(Math.min(3, d.plis[first].length));
    setAdj(seedAdj(d.tpDefault, d.tasasDefault)); setAnul(new Set()); setOverrides(new Set());
  }
  async function onFile(f: File) {
    try { open(parseWorkbook(await f.arrayBuffer())); }
    catch { setErr("No pude leer el archivo. ¿Es el Excel del pipeline con las hojas MR y PLI + Ratios?"); }
  }
  const toggleAnul = (ric: string, year: number) => {
    const n = new Set(anul); const k = `${ric}\t${year}`;
    if (n.has(k)) n.delete(k); else n.add(k);
    setAnul(n);
  };
  const toggleOverride = (ric: string) => {
    const n = new Set(overrides);
    if (n.has(ric)) n.delete(ric); else n.add(ric);
    setOverrides(n);
  };

  const years = useMemo(() => (ds && pli ? ds.plis[pli].slice(0, ny) : []), [ds, pli, ny]);
  const rowsEff = useMemo(
    () => (ds ? (overrides.size ? ds.rows.map((r) => (overrides.has(r.ric) ? { ...r, accepted: true } : r)) : ds.rows) : []),
    [ds, overrides]
  );
  const range = useMemo(() => (ds && pli ? computeRange(rowsEff, pli, years, anul) : null), [ds, pli, rowsEff, years, anul]);
  const { tp, tasas } = useMemo(() => deriveTP(adj.raw, years), [adj.raw, years]);
  const tested = useMemo(() => (ds && pli ? testedIndicator(pli, tp, years) : { pli: NaN, year: null, base: {} }), [ds, pli, tp, years]);
  const adjRange = useMemo(
    () => (ds && pli && adj.on && ds.hasFin ? computeAdjustedRange(rowsEff, pli, years, tp, tasas, adj.esServ, anul) : null),
    [ds, pli, adj.on, adj.esServ, rowsEff, years, tp, tasas, anul]
  );
  const showAdj = adj.on && !!adjRange && adjRange.n > 0;
  const binding = showAdj ? adjRange! : range;
  const belowRange = binding != null && !Number.isNaN(tested.pli) && tested.pli < binding.q1;

  function doExcel() {
    if (!range) return;
    exportExcel({ pli, years, range, adjRange: showAdj ? adjRange : null, base: tested.base, via: adj.via, alic: adj.alic, testedPli: tested.pli, belowRange });
  }
  function doPng() {
    if (!binding) return;
    exportChartPNG({ pli, range: binding, testedPli: tested.pli, minmax, showAdj, testedName: testedName || "Empresa analizada", n: binding.n, years });
  }
  const wordCtx: WordCtx | null = ds ? {
    pli, years, rowsEff, mrRows: ds.mrRows ?? null, analisisRows: ds.analisisRows ?? null,
    tp, esServ: adj.esServ, adjOn: showAdj, testedPli: tested.pli, testedName,
  } : null;

  if (!ds) {
    return (
      <main>
        <Header />
        <UploadZone onFile={onFile} onSample={() => open(loadSample())} />
        {err && <div className="mx-auto max-w-[1120px] px-6 md:px-10"><p className="rounded-lg border-l-2 border-warn bg-warn-tint px-4 py-3 text-[14px]">{err}</p></div>}
      </main>
    );
  }

  return (
    <main>
      <Header onReset={() => setDs(null)} />
      <div className="mx-auto max-w-[1120px] space-y-4 px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-[28px] font-semibold leading-none">{pli}</h2>
            <p className="mt-1.5 text-[13px] text-ink-soft tnum">Promedio de {years.length} años · {[...years].reverse().join(" · ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] text-ink-soft">Indicador
              <select value={pli} onChange={(e) => { setPli(e.target.value); setNy(Math.min(ny, ds.plis[e.target.value].length)); }}
                className="ml-2 rounded-lg border border-line-strong bg-panel px-3 py-1.5 text-ink">
                {Object.keys(ds.plis).map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <span className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-soft tnum">n = {binding?.n} comparables</span>
          </div>
        </div>

        {range && range.n > 0 ? (
          <>
            <RangeCards r={binding!} />
            <RangeChart r={binding!} tested={tested.pli} adjusted={showAdj} />
            <ExportBar minmax={minmax} setMinmax={setMinmax} onExcel={doExcel} onPng={doPng}
              testedName={testedName} setTestedName={setTestedName} onWord={() => setWordOpen(true)} />
            <TestedPanel pli={pli} years={years} range={range} adjRange={adjRange} tested={tested} adj={adj} setAdj={setAdj} hasFin={ds.hasFin} />
            <ComparablesTable years={years} comps={(showAdj ? adjRange! : range).comps} anul={anul} onToggle={toggleAnul} />
            <RejectedPanel rows={ds.rows} pli={pli} years={years} overrides={overrides} onToggle={toggleOverride} />
          </>
        ) : (
          <p className="rounded-lg border-l-2 border-warn bg-warn-tint px-4 py-3 text-[14px]">
            No hay comparables aceptadas para este indicador. Revisá la columna Aceptada (Si/No) en la hoja MR.
          </p>
        )}
      </div>
      <footer className="mx-auto max-w-[1120px] px-6 pb-10 text-[12.5px] text-ink-soft md:px-10">
        compar.ar · versión inicial, uso interno. El motor de cálculo corre en tu navegador.
      </footer>
      {wordCtx && <WordModal open={wordOpen} onClose={() => setWordOpen(false)} ctx={wordCtx} />}
    </main>
  );
}
