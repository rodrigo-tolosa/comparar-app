"use client";
import type { CompRow } from "@/lib/engine";
import { fmtPct } from "@/lib/format";

const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

export function RejectedPanel({ rows, pli, years, overrides, onToggle }: {
  rows: CompRow[];
  pli: string;
  years: number[];
  overrides: Set<string>;
  onToggle: (ric: string) => void;
}) {
  const yAsc = [...years].reverse();
  const rejected = rows
    .filter((r) => !r.accepted)
    .map((r) => {
      const byYear = years.map((y) => r.vals[pli]?.[y] ?? NaN);
      const per = byYear.filter(isNum);
      return { ric: r.ric, empresa: r.empresa, byYear, avg: per.length ? per.reduce((a, b) => a + b, 0) / per.length : NaN };
    })
    .filter((r) => r.byYear.some(isNum))
    .sort((a, b) => (Number.isNaN(b.avg) ? -Infinity : b.avg) - (Number.isNaN(a.avg) ? -Infinity : a.avg));

  if (!rejected.length) return null;
  const incluidas = rejected.filter((r) => overrides.has(r.ric)).length;

  return (
    <details className="rounded-2xl border border-line bg-panel shadow-card">
      <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-4">
        <h3 className="font-medium">
          Empresas rechazadas <span className="text-ink-soft">({rejected.length})</span>
        </h3>
        <span className="text-[12.5px] text-ink-soft">
          {incluidas > 0 ? `${incluidas} incluida${incluidas > 1 ? "s" : ""} en el análisis · ` : ""}revisá si corresponde sumar alguna
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-ink-soft">
              <th className="px-6 py-2.5 text-left font-medium">Empresa</th>
              {yAsc.map((y) => <th key={y} className="px-4 py-2.5 text-right font-medium tnum">{y}</th>)}
              <th className="px-4 py-2.5 text-right font-medium">Promedio</th>
              <th className="px-6 py-2.5 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rejected.map((c) => {
              const on = overrides.has(c.ric);
              const vAsc = [...c.byYear].reverse();
              return (
                <tr key={c.ric} className={`border-t border-line ${on ? "bg-accent-tint" : ""}`}>
                  <td className="px-6 py-2.5">{c.empresa}</td>
                  {vAsc.map((v, i) => <td key={i} className="px-4 py-2.5 text-right tnum">{fmtPct(v)}</td>)}
                  <td className="px-4 py-2.5 text-right font-semibold tnum">{fmtPct(c.avg)}</td>
                  <td className="px-6 py-2.5 text-right">
                    <button
                      onClick={() => onToggle(c.ric)}
                      className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
                        on ? "border-accent bg-accent text-white" : "border-line-strong text-ink hover:border-accent"
                      }`}
                    >
                      {on ? "Incluida ✓ · quitar" : "Incluir en el análisis"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-6 py-3 text-[11.5px] text-ink-soft">
        Estas empresas quedaron con &quot;No&quot; en la hoja MR. Si incluís alguna, entra al rango y a la tabla de comparables (solo en esta sesión, no modifica el Excel).
      </p>
    </details>
  );
}
