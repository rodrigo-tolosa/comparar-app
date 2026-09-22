"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as WordGen from "./wordgen.js";
import type { CompRow, Fin } from "./engine";

export interface WordCtx {
  pli: string;
  years: number[];
  rowsEff: CompRow[];
  mrRows: Record<string, unknown>[] | null;
  analisisRows: Record<string, unknown>[] | null;
  tp: Record<number, Partial<Fin>>;
  esServ: boolean;
  adjOn: boolean;
  testedPli: number;
  testedName: string;
}

function dataByRic(rowsEff: CompRow[], years: number[]) {
  const o: Record<string, any> = {};
  for (const r of rowsEff) {
    if (!r.fin) continue;
    const e: any = { nombre: r.empresa };
    for (const y of years) e[y] = r.fin[y] || {};
    o[r.ric] = e;
  }
  return o;
}
function pliByRic(rowsEff: CompRow[], pli: string) {
  const o: Record<string, any> = {};
  for (const r of rowsEff) { o[r.ric] = {}; o[r.ric][pli] = r.vals[pli] || {}; }
  return o;
}
function accRics(rowsEff: CompRow[]) { return rowsEff.filter((r) => r.accepted).map((r) => r.ric); }

// MR con la aceptación efectiva (aplica las "incluidas" desde el panel de rechazadas)
function mrEff(mrRows: Record<string, unknown>[] | null, rowsEff: CompRow[]) {
  if (!mrRows) return [];
  const acc = new Set(rowsEff.filter((r) => r.accepted).map((r) => r.ric));
  return mrRows.map((m) => {
    const ric = String((m as any).RIC ?? "").trim();
    return { ...m, "Aceptada (Si/No)": acc.has(ric) ? "Si" : ((m as any)["Aceptada (Si/No)"] ?? "No") };
  });
}

export function renderEmbudoPNG(stages: [string, number][]): Uint8Array | null {
  if (!stages || stages.length < 2 || typeof document === "undefined") return null;
  const NAVY = "#1F4E79", MED = "#2E75B6", GREEN = "#548235", ACCENT = "#C55A11";
  const n = stages.length, maxv = Math.max(1, ...stages.map((s) => s[1]));
  const W = 900, rowH = 64, gap = 24, top = 20, bottom = 20;
  const H = top + bottom + n * (rowH + gap) - gap;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const plotL = W * 0.3, plotW = W * 0.55; ctx.textBaseline = "middle";
  stages.forEach((s, i) => {
    const [et, v] = s; const y = top + i * (rowH + gap) + rowH / 2;
    const bw = (v / maxv) * plotW, left = plotL + (plotW - bw) / 2;
    const col = i === 0 ? NAVY : i === n - 1 ? GREEN : MED;
    ctx.fillStyle = col; ctx.fillRect(left, y - rowH / 2, bw, rowH);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(left, y - rowH / 2, bw, rowH);
    const label = v.toLocaleString("es-AR");
    if (bw < plotW * 0.1) { ctx.fillStyle = col; ctx.font = "bold 15px Inter,sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, left + bw + 8, y); }
    else { ctx.fillStyle = "#fff"; ctx.font = "bold 15px Inter,sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, plotL + plotW / 2, y); }
    ctx.fillStyle = "#333"; ctx.font = "14px Inter,sans-serif"; ctx.textAlign = "right"; ctx.fillText(et, plotL - 14, y);
    if (i > 0) { const caida = stages[i - 1][1] - v; if (caida !== 0) { ctx.fillStyle = ACCENT; ctx.font = "bold 13px Inter,sans-serif"; ctx.textAlign = "left"; ctx.fillText("−" + caida.toLocaleString("es-AR"), plotL + plotW + 16, y); } }
  });
  const b64 = cv.toDataURL("image/png").split(",")[1], bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function download(doc: any, filename: string) {
  const blob = await WordGen.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const WORD_FILES: Record<string, string> = {
  tested: "financiero_parte_analizada",
  fin: "estados_financieros_comparables",
  listado: "listado_aceptadas",
  desc: "descripcion_aceptadas",
  rech: "razones_rechazo",
};

// nombre de archivo seguro a partir del nombre de la tested party
function safeName(s: string): string {
  return s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 60) || "tested";
}

export async function generateWord(kind: string, ctx: WordCtx) {
  if (!ctx.testedName.trim()) throw new Error("Cargá el nombre de la parte analizada antes de descargar.");
  const { years, pli } = ctx;
  const suf = safeName(ctx.testedName);
  const mr = mrEff(ctx.mrRows, ctx.rowsEff);
  if (kind === "all") {
    for (const k of ["tested", "fin", "listado", "desc", "rech"]) {
      await generateWord(k, ctx);
      await new Promise((r) => setTimeout(r, 350));
    }
    return;
  }
  let doc: any;
  if (kind === "tested") {
    doc = WordGen.testedParty(ctx.tp, {
      nombre: ctx.testedName || "Parte analizada", pliNombre: pli, pliValor: ctx.testedPli,
      esServicios: ctx.esServ, hacerAjuste: ctx.adjOn, years,
    });
  } else if (kind === "fin") {
    doc = WordGen.estadosFinancieros(dataByRic(ctx.rowsEff, years), pliByRic(ctx.rowsEff, pli), accRics(ctx.rowsEff), years, { pliNombre: pli });
  } else if (kind === "listado") {
    doc = WordGen.listado(mr);
  } else if (kind === "desc") {
    doc = WordGen.descripcion(mr);
  } else if (kind === "rech") {
    const stages = WordGen.construirEmbudo(ctx.analisisRows || [], mr) as [string, number][];
    doc = WordGen.rechazos(ctx.analisisRows || [], mr, renderEmbudoPNG(stages));
  } else return;
  await download(doc, `${WORD_FILES[kind]}_${suf}.docx`);
}
