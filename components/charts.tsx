"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer } from "recharts";
import type { RangeStats } from "@/lib/engine";
import { fmtPct } from "@/lib/format";
import { useState } from "react";

export function RangeChart({ r, tested, adjusted }: { r: RangeStats; tested?: number; adjusted?: boolean }) {
  const data = [
    { name: "Mínimo", v: r.min, k: "edge" },
    { name: "Q1", v: r.q1, k: "q" },
    { name: "Mediana", v: r.med, k: "med" },
    { name: "Q3", v: r.q3, k: "q" },
    { name: "Máximo", v: r.max, k: "edge" },
  ];
  const color = (k: string) => (k === "med" ? "var(--accent)" : k === "edge" ? "#93A3B8" : "#4472C4");
  const hasTested = typeof tested === "number" && !Number.isNaN(tested);
  const inside = hasTested && tested! >= r.q1 && tested! <= r.q3;
  return (
    <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
      {adjusted && <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-accent">rango ajustado (vinculante)</div>}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="name" tick={{ fill: "var(--ink-soft)", fontSize: 13 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} />
            <YAxis tickFormatter={(v) => (v * 100).toFixed(0) + "%"} tick={{ fill: "var(--ink-soft)", fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
            {hasTested && (
              <ReferenceLine
                y={tested}
                stroke={inside ? "var(--accent)" : "var(--warn)"}
                strokeDasharray="5 4"
                strokeWidth={2}
                label={{ value: `Empresa analizada ${fmtPct(tested!)}`, position: "insideTopLeft", fill: inside ? "var(--accent)" : "var(--warn)", fontSize: 12, fontWeight: 600 }}
              />
            )}
            <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={84}>
              {data.map((d, i) => <Cell key={i} fill={color(d.k)} />)}
              <LabelList dataKey="v" position="top" formatter={(v) => fmtPct(Number(v))} style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type Comp = { ric: string; empresa: string; byYear: number[]; avg: number };

export function ComparablesTable({ years, comps, anul, onToggle }: {
  years: number[]; comps: Comp[];
  anul: Set<string>; onToggle: (ric: string, year: number) => void;
}) {
  const [sortAvg, setSortAvg] = useState(true);
  const yAsc = [...years].reverse();
  const rows = [...comps].sort((a, b) => {
    if (sortAvg) { const av = Number.isNaN(a.avg) ? -Infinity : a.avg, bv = Number.isNaN(b.avg) ? -Infinity : b.avg; return bv - av; }
    return a.empresa.localeCompare(b.empresa);
  });
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-card">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h3 className="font-medium">Comparables</h3>
        <span className="text-[12px] text-ink-soft tnum">{yAsc.join(" · ")}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-ink-soft">
              <th className="cursor-pointer px-6 py-2.5 text-left font-medium" onClick={() => setSortAvg(false)}>Empresa</th>
              {yAsc.map((y) => <th key={y} className="px-4 py-2.5 text-right font-medium tnum">{y}</th>)}
              <th className="cursor-pointer px-6 py-2.5 text-right font-medium" onClick={() => setSortAvg(true)}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const vAsc = [...c.byYear].reverse();
              return (
                <tr key={c.ric} className="border-t border-line">
                  <td className="px-6 py-2.5">{c.empresa}</td>
                  {vAsc.map((v, i) => {
                    const y = yAsc[i];
                    const off = anul.has(`${c.ric}\t${y}`);
                    return (
                      <td key={i}
                        data-ric={c.ric} data-y={y}
                        onClick={() => onToggle(c.ric, y)}
                        title={`Tocá para ${off ? "reactivar" : "anular"} ${y}`}
                        className={`cursor-pointer px-4 py-2.5 text-right tnum hover:bg-accent-tint ${off ? "text-ink-soft line-through decoration-warn" : ""}`}>
                        {fmtPct(v)}
                      </td>
                    );
                  })}
                  <td className="px-6 py-2.5 text-right font-semibold tnum">{fmtPct(c.avg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-6 py-3 text-[11.5px] text-ink-soft">
        Tocá el valor de un año para anularlo si fue atípico; el promedio y los rangos se recalculan al instante.
      </p>
    </div>
  );
}
