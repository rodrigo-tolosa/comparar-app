"use client";
import type { Fin, RangeStats } from "@/lib/engine";
import { baseImponible } from "@/lib/engine";
import { fmtPct, fmtNum, parseNum } from "@/lib/format";

export interface AdjState {
  on: boolean;
  esServ: boolean;
  raw: Record<string, string>; // `${year}:${field}` -> texto
  via: "costos" | "ingresos";
  alic: number;
}

export const emptyAdj = (): AdjState => ({ on: false, esServ: false, raw: {}, via: "costos", alic: 0.35 });

/** Semilla de la grilla desde los defaults de la muestra. */
export function seedAdj(
  tpDefault: Record<string, Partial<Fin>> | null | undefined,
  tasasDefault: Record<string, number> | null | undefined
): AdjState {
  const raw: Record<string, string> = {};
  if (tpDefault) for (const y in tpDefault) for (const k in tpDefault[y]) {
    const v = (tpDefault[y] as Record<string, number>)[k];
    if (v != null) raw[`${y}:${k}`] = String(v).replace(".", ",");
  }
  if (tasasDefault) for (const y in tasasDefault) raw[`${y}:i`] = String(tasasDefault[y] * 100).replace(".", ",");
  return { ...emptyAdj(), raw };
}

/** Deriva la tested party por año y las tasas desde el texto de la grilla. */
export function deriveTP(raw: Record<string, string>, years: number[]) {
  const tp: Record<number, Partial<Fin>> = {};
  const tasas: Record<number, number> = {};
  const F: (keyof Fin)[] = ["V", "C", "S", "AR", "AP", "INV", "TA", "INT"];
  for (const y of years) {
    tp[y] = {};
    for (const k of F) { const v = parseNum(raw[`${y}:${k}`]); if (!Number.isNaN(v)) tp[y][k] = v; }
    const t = parseNum(raw[`${y}:i`]); if (!Number.isNaN(t)) tasas[y] = t / 100;
  }
  return { tp, tasas };
}

const BASE_COLS: [keyof Fin | "i", string][] = [["V", "Ventas"], ["C", "Costo"], ["S", "Gastos op."]];
const ASSET_COLS: [keyof Fin | "i", string][] = [["TA", "Activos totales"], ["INT", "Intangibles"]];
const PATRIM_COLS: [keyof Fin | "i", string][] = [["AR", "Ctas. a cobrar"], ["AP", "Ctas. a pagar"], ["INV", "Inventarios"], ["i", "Tasa %"]];
const PATRIM = new Set(["AR", "AP", "INV", "i"]);

export function TestedPanel({
  pli, years, range, adjRange, tested, adj, setAdj, hasFin,
}: {
  pli: string;
  years: number[];
  range: RangeStats;
  adjRange: RangeStats | null;
  tested: { pli: number; year: number | null; base: Partial<Fin> };
  adj: AdjState;
  setAdj: (a: AdjState) => void;
  hasFin: boolean;
}) {
  const showAdj = adj.on && !!adjRange && adjRange.n > 0;
  const needsAssets = pli.includes("Activos");
  const cols = [...BASE_COLS, ...(needsAssets ? ASSET_COLS : []), ...PATRIM_COLS];
  const binding = showAdj ? adjRange! : range;
  const tp = tested.pli;
  const hasTP = !Number.isNaN(tp);
  const setRaw = (key: string, val: string) => setAdj({ ...adj, raw: { ...adj.raw, [key]: val } });

  // veredicto
  let vClass = "", vTxt = "";
  if (hasTP) {
    const etq = showAdj ? "ajustado" : "de comparables";
    if (tp < binding.q1) { vClass = "warn"; vTxt = tp < binding.min ? "Por debajo del mínimo" : `Por debajo del rango ${etq}`; }
    else if (tp > binding.q3) { vClass = "in"; vTxt = `Por encima del rango ${etq}`; }
    else { vClass = "in"; vTxt = `Dentro del rango ${etq}`; }
  }

  // base imponible
  const b = tested.base;
  const ao = b.TA != null && b.INT != null && !Number.isNaN(b.TA) && !Number.isNaN(b.INT) ? b.TA - b.INT : NaN;
  const belowRange = hasTP && tp < binding.q1 && b.V != null && b.C != null;
  const aj = belowRange ? baseImponible(pli, binding.med, b.V!, b.C!, b.S ?? NaN, ao, adj.via) : null;

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-card">
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h3 className="font-medium">Empresa analizada (tested party)</h3>
          <p className="mt-1 max-w-[62ch] text-[13px] text-ink-soft">
            Cargá sus resultados y compar.ar calcula el margen del último año y lo ubica en el rango.
            El ajuste de patrimoniales es opcional: lo prende el analista.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2.5 text-[13.5px] text-ink-soft">
          <span className="relative inline-block h-[23px] w-[40px]">
            <input type="checkbox" className="peer sr-only" checked={adj.on} onChange={(e) => setAdj({ ...adj, on: e.target.checked })} />
            <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-accent" />
            <span className="absolute left-[2px] top-[2px] h-[19px] w-[19px] rounded-full bg-white shadow transition peer-checked:translate-x-[17px]" />
          </span>
          Aplicar ajuste
        </label>
      </div>

      <div className="border-t border-line px-6 py-5">
        {adj.on && !hasFin && (
          <p className="mb-4 rounded-lg border-l-2 border-warn bg-warn-tint px-4 py-2.5 text-[13.5px]">
            Este archivo no trae la hoja Data con los financieros crudos: no puedo calcular el ajuste. Igual ubico el margen sin ajustar.
          </p>
        )}
        <label className="mb-4 flex items-center gap-2 text-[14px]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" disabled={!adj.on}
            checked={adj.esServ} onChange={(e) => setAdj({ ...adj, esServ: e.target.checked })} />
          <span className={adj.on ? "" : "text-ink-soft"}>La empresa presta únicamente servicios (sin inventarios)</span>
        </label>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-ink-soft">
                <th className="px-2 py-1.5 text-left font-medium">Año</th>
                {cols.map(([k, label]) => (
                  <th key={k} className={`px-2 py-1.5 text-right font-medium ${!adj.on && PATRIM.has(k) ? "opacity-50" : ""}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y}>
                  <td className="px-2 py-1.5 text-ink-soft tnum">{y}</td>
                  {cols.map(([k]) => {
                    const dis = !adj.on && PATRIM.has(k);
                    return (
                      <td key={k} className="px-2 py-1.5">
                        <input
                          inputMode="decimal" disabled={dis}
                          value={adj.raw[`${y}:${k}`] ?? ""}
                          onChange={(e) => setRaw(`${y}:${k}`, e.target.value)}
                          className="w-[84px] rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right tnum text-ink outline-none focus:border-accent disabled:bg-line disabled:text-ink-soft disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!adj.on && <p className="mt-2.5 text-[12px] text-ink-soft">Con el ajuste desactivado alcanza con ventas, costo y gastos. Activá &quot;Aplicar ajuste&quot; para habilitar las patrimoniales.</p>}

        <details className="mt-4 rounded-xl border border-line bg-paper">
          <summary className="cursor-pointer select-none px-4 py-3 text-[13.5px] font-medium">¿Qué fórmula aplica cada ajuste patrimonial?</summary>
          <div className="space-y-3 border-t border-line px-4 py-3 text-[12.5px]">
            <Formula titulo="Cuentas a cobrar (sobre ventas)" f="Ventas_aj = Ventas − ( (CtasCobrar_TP / Ventas_TP × Ventas_comp − CtasCobrar_comp) × i / (1 + i) )" />
            <Formula titulo="Cuentas a pagar (sobre costo)" f="Costo_aj = Costo − ( (CtasPagar_TP / Ventas_TP × Ventas_comp − CtasPagar_comp) × i / (1 + i) )" />
            <Formula titulo="Inventarios (sobre costo, si no es servicios)" f="Costo_aj = Costo_aj − ( (Inventarios_TP / Ventas_TP × Ventas_comp − Inventarios_comp) × i )" />
            <p className="text-ink-soft"><b>i</b> = tasa del año · <b>TP</b> = empresa analizada · <b>comp</b> = cada comparable. Con Ventas_aj y Costo_aj se recalcula el margen de cada comparable, y de ahí el rango ajustado.</p>
          </div>
        </details>

        {(range.n > 0) && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="text-[14px]">
              Margen de la empresa analizada:{" "}
              <b className="tnum text-accent">{hasTP ? fmtPct(tp) : "—"}</b>{" "}
              <span className="text-[12.5px] text-ink-soft">{hasTP ? `calculado del último año (${tested.year})` : (needsAssets ? "este indicador es sobre activos: cargá ventas, costo, gastos y activos del último año" : "cargá ventas, costo y gastos del último año para verlo")}</span>
            </div>

            {showAdj && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-line px-4 py-3">
                  <div className="text-[12px] text-ink-soft">Rango sin ajustar</div>
                  <div className="tnum mt-1 text-[16px]">{fmtPct(range.q1)} · <b>{fmtPct(range.med)}</b> · {fmtPct(range.q3)}</div>
                </div>
                <div className="rounded-xl border border-accent bg-accent-tint px-4 py-3">
                  <div className="flex items-center gap-2 text-[12px] text-ink-soft">Rango ajustado <span className="rounded-full border border-accent px-2 text-[10px] font-semibold uppercase text-accent">vinculante</span></div>
                  <div className="tnum mt-1 text-[16px]">{fmtPct(adjRange!.q1)} · <b className="text-accent">{fmtPct(adjRange!.med)}</b> · {fmtPct(adjRange!.q3)}</div>
                </div>
              </div>
            )}

            {hasTP && (
              <div className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] ${vClass === "in" ? "bg-accent-tint text-accent" : "bg-warn-tint text-warn"}`}>
                <span className="h-2 w-2 rounded-full bg-current" /> {vTxt} <span className="text-[12.5px] opacity-80">rinde {fmtPct(tp)}</span>
              </div>
            )}

            {belowRange && (
              <div className="mt-4 rounded-xl border border-warn bg-warn-tint p-4">
                <h4 className="font-medium text-warn">Ajuste de base imponible</h4>
                <p className="mt-1 text-[13.5px]">La empresa cae por debajo del rango vinculante. Para llevar su indicador a la mediana:</p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
                    {(["costos", "ingresos"] as const).map((v) => (
                      <button key={v} onClick={() => setAdj({ ...adj, via: v })}
                        className={`px-3 py-1.5 text-[13px] ${adj.via === v ? "bg-ink text-paper" : "bg-panel text-ink-soft"}`}>
                        {v === "costos" ? "Vía costos (importador)" : "Vía ingresos (exportador)"}
                      </button>
                    ))}
                  </div>
                  <label className="text-[13px] text-ink-soft">Alícuota
                    <select value={adj.alic} onChange={(e) => setAdj({ ...adj, alic: parseFloat(e.target.value) })}
                      className="ml-2 rounded-lg border border-line-strong bg-paper px-2 py-1.5 text-ink">
                      <option value={0.35}>35%</option><option value={0.30}>30%</option><option value={0.25}>25%</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Stat k="Ajuste a la base imponible" v={aj == null ? "—" : fmtNum(aj)} />
                  <Stat k="Impuesto resultante" v={aj == null ? "—" : fmtNum(aj * adj.alic)} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Formula({ titulo, f }: { titulo: string; f: string }) {
  return (
    <div>
      <div className="font-medium">{titulo}</div>
      <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded-md border border-line bg-panel px-3 py-2 font-mono text-[11.5px] text-ink-soft">{f}</code>
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <div className="text-[12px] text-ink-soft">{k}</div>
      <div className="display tnum mt-0.5 text-[22px] font-semibold">{v}</div>
    </div>
  );
}
