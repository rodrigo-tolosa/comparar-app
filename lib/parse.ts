import * as XLSX from "xlsx";
import type { CompRow, Fin } from "./engine";
import { parseNum } from "./format";
import sampleRaw from "@/app/sample.json";

export interface Dataset {
  plis: Record<string, number[]>;
  rows: CompRow[];
  hasFin: boolean;
  tpDefault?: Record<string, Partial<Fin>> | null;
  tasasDefault?: Record<string, number> | null;
}

const FIN_FIELDS: Record<keyof Fin, string> = {
  V: "Revenue from Goods & Services",
  C: "Cost of Revenues - Total",
  S: "Selling General & Administrative Expenses - Total",
  AR: "AccountsReceivable",
  AP: "AccountsPayable",
  INV: "Inventories",
  TA: "Total Assets",
  INT: "Intangible Assets - Total - Net",
};

const ACCEPTED = new Set(["si", "sí", "s", "yes"]);
const isAccepted = (v: unknown) => ACCEPTED.has(String(v ?? "").trim().toLowerCase());

/** Detecta las columnas PLI ("<PLI>_<año>") y arma el mapa PLI -> años (desc). */
function detectPlis(rows: Record<string, unknown>[]): Record<string, number[]> {
  const plis: Record<string, Set<number>> = {};
  if (!rows.length) return {};
  for (const key of Object.keys(rows[0])) {
    const m = key.match(/^(Margen .+)_(\d{4})$/);
    if (m) (plis[m[1]] ??= new Set()).add(Number(m[2]));
  }
  const out: Record<string, number[]> = {};
  for (const p in plis) out[p] = [...plis[p]].sort((a, b) => b - a);
  return out;
}

export function parseWorkbook(buf: ArrayBuffer): Dataset {
  const wb = XLSX.read(buf);
  const sheet = (name: string) =>
    wb.Sheets[name] ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }) as Record<string, unknown>[]) : null;

  const pliRows = sheet("PLI + Ratios") ?? [];
  const mrRows = sheet("MR") ?? [];
  const dataRows = sheet("Data");
  const plis = detectPlis(pliRows);
  const allYears = [...new Set(Object.values(plis).flat())];

  const acc = new Set(mrRows.filter((r) => isAccepted(r["Aceptada (Si/No)"])).map((r) => String(r["RIC"] ?? "").trim()));

  const finByRic: Record<string, Record<string, Partial<Fin>>> = {};
  if (dataRows) {
    for (const r of dataRows) {
      const ric = String(r["RIC"] ?? "").trim();
      const fin: Record<string, Partial<Fin>> = {};
      for (const y of allYears) {
        const f: Partial<Fin> = {};
        (Object.keys(FIN_FIELDS) as (keyof Fin)[]).forEach((k) => { f[k] = parseNum(r[`${FIN_FIELDS[k]}_${y}`]); });
        fin[y] = f;
      }
      finByRic[ric] = fin;
    }
  }

  const rows: CompRow[] = pliRows.map((r) => {
    const ric = String(r["RIC"] ?? "").trim();
    const vals: Record<string, Record<string, number>> = {};
    for (const p in plis) { vals[p] = {}; plis[p].forEach((y) => { vals[p][y] = parseNum(r[`${p}_${y}`]); }); }
    return {
      ric,
      empresa: String(r["Empresa"] ?? r["Company Common Name"] ?? ric).trim(),
      accepted: acc.has(ric),
      vals,
      fin: finByRic[ric] ?? null,
    };
  });

  return { plis, rows, hasFin: !!dataRows };
}

/** Muestra embebida para "probar con datos de ejemplo". */
export function loadSample(): Dataset {
  const s = sampleRaw as unknown as {
    plis: Record<string, string[]>;
    rows: { ric: string; empresa: string; accepted: boolean; vals: Record<string, Record<string, number | null>>; fin: Record<string, Record<string, number | null>> | null }[];
    tpDefault?: Record<string, Record<string, number>> | null;
    tasasDefault?: Record<string, number> | null;
  };
  const plis: Record<string, number[]> = {};
  for (const p in s.plis) plis[p] = s.plis[p].map(Number).sort((a, b) => b - a);
  const num = (v: number | null) => (v == null ? NaN : v);
  const rows: CompRow[] = s.rows.map((r) => {
    const vals: Record<string, Record<string, number>> = {};
    for (const p in r.vals) { vals[p] = {}; for (const y in r.vals[p]) vals[p][y] = num(r.vals[p][y]); }
    let fin: Record<string, Partial<Fin>> | null = null;
    if (r.fin) { fin = {}; for (const y in r.fin) { const f: Record<string, number> = {}; for (const k in r.fin[y]) f[k] = num(r.fin[y][k]); fin[y] = f as Partial<Fin>; } }
    return { ric: r.ric, empresa: r.empresa, accepted: r.accepted, vals, fin };
  });
  return {
    plis, rows, hasFin: rows.some((r) => r.fin),
    tpDefault: (s.tpDefault as Record<string, Partial<Fin>>) ?? null,
    tasasDefault: s.tasasDefault ?? null,
  };
}
