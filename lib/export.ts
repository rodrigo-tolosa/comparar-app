"use client";
import * as XLSX from "xlsx";
import type { RangeStats, Fin } from "./engine";
import { baseImponible } from "./engine";

export type Comp = { ric: string; empresa: string; byYear: number[]; avg: number };
type FullRange = RangeStats & { comps: Comp[] };

const PCTZ = "0.00%", NUMZ = "#,##0.00";
type WS = XLSX.WorkSheet;
const fmtCell = (ws: WS, c: number, r: number, z: string) => {
  const ref = XLSX.utils.encode_cell({ c, r });
  const cell = ws[ref] as XLSX.CellObject | undefined;
  if (cell && typeof cell.v === "number") { cell.z = z; cell.t = "n"; }
};
const fmtBlock = (ws: WS, c0: number, c1: number, r0: number, r1: number, z: string) => {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) fmtCell(ws, c, r, z);
};

export function exportExcel(opts: {
  pli: string; years: number[];
  range: FullRange;
  adjRange: FullRange | null;
  base: Partial<Fin>;
  via: "costos" | "ingresos"; alic: number; testedPli: number; belowRange: boolean;
}) {
  const { pli, years, range, adjRange } = opts;
  const yDesc = [...years];
  const wb = XLSX.utils.book_new();

  const rango = [
    ["Indicador (PLI)", pli], ["Comparables (n)", range.n], ["Años", [...yDesc].reverse().join(", ")], [],
    ["Estadístico", "Valor"], ["Mínimo", range.min], ["Cuartil inferior (Q1)", range.q1],
    ["Mediana", range.med], ["Cuartil superior (Q3)", range.q3], ["Máximo", range.max],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(rango);
  fmtBlock(ws1, 1, 1, 5, 9, PCTZ); ws1["!cols"] = [{ wch: 24 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Rango");

  const compSheet = (r: FullRange, promLabel: string): WS => {
    const head = ["Empresa", "RIC", ...[...yDesc].reverse(), promLabel];
    const body = [...r.comps].sort((a, b) => b.avg - a.avg).map((c) => [c.empresa, c.ric, ...[...c.byYear].reverse(), c.avg]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    fmtBlock(ws, 2, 2 + years.length, 1, body.length, PCTZ);
    ws["!cols"] = [{ wch: 32 }, { wch: 14 }, ...years.map(() => ({ wch: 10 })), { wch: 14 }];
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, compSheet(range, "Promedio"), "Comparables");

  if (adjRange && adjRange.n > 0) {
    const rangoAj = [
      ["Indicador (PLI)", pli], ["Comparables (n)", adjRange.n], ["Años", [...yDesc].reverse().join(", ")], [],
      ["Estadístico", "Sin ajuste", "Ajustado"],
      ["Mínimo", range.min, adjRange.min], ["Cuartil inferior (Q1)", range.q1, adjRange.q1],
      ["Mediana", range.med, adjRange.med], ["Cuartil superior (Q3)", range.q3, adjRange.q3],
      ["Máximo", range.max, adjRange.max],
    ];
    const wsAj = XLSX.utils.aoa_to_sheet(rangoAj); fmtBlock(wsAj, 1, 2, 5, 9, PCTZ); wsAj["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsAj, "Rango ajustado");
    XLSX.utils.book_append_sheet(wb, compSheet(adjRange, "Promedio ajustado"), "Comparables ajustados");

    if (opts.belowRange && opts.base.V != null && opts.base.C != null) {
      const ao = opts.base.TA != null && opts.base.INT != null ? opts.base.TA - opts.base.INT : NaN;
      const aj = baseImponible(pli, adjRange.med, opts.base.V, opts.base.C, opts.base.S ?? NaN, ao, opts.via);
      const bi = [
        ["Ajuste de base imponible"], [], ["Vía", opts.via], ["Mediana ajustada", adjRange.med],
        ["Indicador tested party", opts.testedPli], ["Ajuste a la base imponible", aj],
        ["Alícuota Ganancias", opts.alic], ["Impuesto resultante", aj == null ? null : aj * opts.alic],
      ];
      const wsbi = XLSX.utils.aoa_to_sheet(bi);
      [3, 4, 6].forEach((r) => fmtCell(wsbi, 1, r, PCTZ));
      [5, 7].forEach((r) => fmtCell(wsbi, 1, r, NUMZ));
      wsbi["!cols"] = [{ wch: 26 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsbi, "Base imponible");
    }
  }
  XLSX.writeFile(wb, "rango_comparar.xlsx");
}

/** Gráfico de barras vertical (azul cuartiles/mín/máx, verde tested) -> PNG descargable. */
export function exportChartPNG(opts: {
  pli: string; range: RangeStats; testedPli: number;
  minmax: boolean; showAdj: boolean; testedName: string; n: number; years: number[];
}) {
  const { range: R, testedPli: tp, minmax, showAdj } = opts;
  type Bar = { label: string; val: number; t: boolean };
  const bars: Bar[] = [];
  if (minmax) bars.push({ label: "Mínimo", val: R.min, t: false });
  bars.push({ label: "Primer Cuartil", val: R.q1, t: false });
  bars.push({ label: "Mediana", val: R.med, t: false });
  bars.push({ label: "Tercer Cuartil", val: R.q3, t: false });
  if (minmax) bars.push({ label: "Máximo", val: R.max, t: false });
  if (!Number.isNaN(tp)) bars.push({ label: opts.testedName || "Empresa analizada", val: tp, t: true });
  bars.sort((a, b) => a.val - b.val);

  const W = 980, H = 600, scale = 2;
  const cv = document.createElement("canvas"); cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext("2d")!; ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  const ink = "#161A16", soft = "#6A716A", blue = "#4472C4", green = "#2E9E5B", grid = "#E6E7E3";
  const pctS = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";
  const pctAx = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%";

  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink; ctx.font = "bold 24px Inter,Arial,sans-serif"; ctx.fillText(opts.pli, 60, 44);
  ctx.fillStyle = soft; ctx.font = "14px Inter,Arial,sans-serif";
  ctx.fillText(`${opts.n} comparables · ${[...opts.years].reverse().join(" · ")} · ${showAdj ? "rango ajustado" : "sin ajustar"}`, 60, 68);

  const padL = 76, padR = W - 40, plotTop = 95, plotBottom = 500, plotH = plotBottom - plotTop, plotW = padR - padL;
  const vals = bars.map((b) => b.val);
  let yMax = Math.max(...vals, 0), yMin = Math.min(...vals, 0);
  const sp = yMax - yMin || Math.abs(yMax) || 1; yMax += sp * 0.16; if (yMin < 0) yMin -= sp * 0.06;
  const y = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin)) * plotH;
  const baseY = y(0);

  ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.font = "12px Inter,Arial,sans-serif";
  for (let i = 0; i <= 5; i++) { const val = yMin + (yMax - yMin) * i / 5, yy = y(val);
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padR, yy); ctx.stroke();
    ctx.fillStyle = soft; ctx.fillText(pctAx(val), padL - 10, yy); }
  ctx.strokeStyle = "#C9CCC7"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(padL, baseY); ctx.lineTo(padR, baseY); ctx.stroke();

  const slot = plotW / bars.length, bw = Math.min(96, slot * 0.52);
  bars.forEach((b, i) => {
    const cx = padL + slot * (i + 0.5), col = b.t ? green : blue;
    const yv = y(b.val), top = Math.min(yv, baseY), h = Math.abs(yv - baseY);
    ctx.fillStyle = col; ctx.fillRect(cx - bw / 2, top, bw, h);
    ctx.textAlign = "center"; ctx.font = "bold 13px Inter,Arial,sans-serif";
    if (h > 34) { ctx.fillStyle = "#fff"; ctx.textBaseline = "bottom"; ctx.fillText(pctS(b.val), cx, baseY - 10); }
    else { ctx.fillStyle = col; ctx.textBaseline = "bottom"; ctx.fillText(pctS(b.val), cx, top - 6); }
    ctx.fillStyle = ink; ctx.textBaseline = "top"; ctx.font = "13px Inter,Arial,sans-serif";
    const w = b.label.split(" ");
    if (w.length > 1 && b.label.length > 11) { ctx.fillText(w.slice(0, -1).join(" "), cx, plotBottom + 16); ctx.fillText(w.slice(-1)[0], cx, plotBottom + 34); }
    else ctx.fillText(b.label, cx, plotBottom + 16);
  });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = soft; ctx.font = "12px Inter,Arial,sans-serif";
  ctx.fillText("compar.ar · rango de tus comparables", 60, H - 20);

  cv.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = url; a.download = "grafico_rango.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}
