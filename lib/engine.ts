// Motor de cálculo de precios de transferencia — funciones puras, sin dependencias.
// Portado y verificado contra el pipeline Python (eikon_pipeline_v3).

export type PLIName = string;

export interface RangeStats {
  n: number;
  min: number;
  q1: number;
  med: number;
  q3: number;
  max: number;
}

export interface Fin {
  V: number; C: number; S: number;
  AR: number; AP: number; INV: number;
  TA: number; INT: number;
}

export interface CompRow {
  ric: string;
  empresa: string;
  accepted: boolean;
  vals: Record<PLIName, Record<string, number>>; // PLI -> año -> ratio
  fin: Record<string, Partial<Fin>> | null;      // año -> financieros crudos
}

export interface TestedByYear {
  [year: number]: Partial<Fin>;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

export const safeDiv = (a: number, b: number): number =>
  isNum(a) && isNum(b) && b !== 0 ? a / b : NaN;

/** PERCENTILE.INC — idéntico a pandas .quantile() y Excel. `s` debe venir ordenado asc. */
export function quantileInc(s: number[], q: number): number {
  const n = s.length;
  if (!n) return NaN;
  if (n === 1) return s[0];
  const p = (n - 1) * q;
  const b = Math.floor(p);
  const r = p - b;
  return b + 1 < n ? s[b] + r * (s[b + 1] - s[b]) : s[b];
}

export function rangeOf(values: number[]): RangeStats {
  const s = values.filter(isNum).sort((a, b) => a - b);
  return {
    n: s.length,
    min: quantileInc(s, 0),
    q1: quantileInc(s, 0.25),
    med: quantileInc(s, 0.5),
    q3: quantileInc(s, 0.75),
    max: quantileInc(s, 1),
  };
}

/** Ratio de rentabilidad según el PLI, a partir de financieros crudos. */
export function ratioPLI(
  pli: PLIName, v: number, c: number, s: number, a: number, i: number
): number {
  const ub = isNum(v) && isNum(c) ? v - c : NaN;
  const uo = isNum(v) && isNum(c) && isNum(s) ? v - c - s : NaN;
  const ao = isNum(a) && isNum(i) ? a - i : a;
  switch (pli) {
    case "Margen Bruto / Ventas": return safeDiv(ub, v);
    case "Margen Bruto / Costos": return safeDiv(ub, c);
    case "Margen Neto / Costos Totales":
      return safeDiv(uo, isNum(c) && isNum(s) ? c + s : NaN);
    case "Margen Operativo / Ventas": return safeDiv(uo, v);
    case "Margen Operativo / Activos": return safeDiv(uo, ao);
    default: return NaN;
  }
}

const present = (...xs: number[]) => xs.every(isNum);

/** Ajuste por capital de trabajo de un comparable (por año). Devuelve el ratio ajustado por año. */
export function adjustComparable(
  fin: Record<string, Partial<Fin>> | null,
  years: number[],
  pli: PLIName,
  tp: TestedByYear,
  rates: Record<number, number>,
  esServicios: boolean
): { byYear: Record<number, number>; avg: number } {
  const byYear: Record<number, number> = {};
  for (const y of years) {
    const i = rates[y] ?? 0;
    const f = (fin && fin[y]) || {};
    const vn = f.V ?? NaN, cv = f.C ?? NaN, sga = f.S ?? NaN;
    const cc = f.AR ?? NaN, cp = f.AP ?? NaN, inv = f.INV ?? NaN;
    const ta = f.TA ?? NaN, intg = f.INT ?? NaN;
    const t = tp[y] || {};
    const vnc = t.V ?? NaN, ccc = t.AR ?? NaN, cpc = t.AP ?? NaN, invc = t.INV ?? NaN;

    let vnAdj = vn;
    if (present(ccc, vnc, vn, cc, i) && vnc !== 0)
      vnAdj = vn - ((ccc / vnc) * vn - cc) * (i / (1 + i));

    let cvAdj = cv;
    if (present(cpc, vnc, vn, cp, i) && vnc !== 0)
      cvAdj = isNum(cv) ? cv - ((cpc / vnc) * vn - cp) * (i / (1 + i)) : NaN;

    if (!esServicios && present(invc, vnc, vn, inv, i) && vnc !== 0)
      cvAdj = (isNum(cvAdj) ? cvAdj : cv) - ((invc / vnc) * vn - inv) * i;

    byYear[y] = ratioPLI(pli, vnAdj, cvAdj, sga, ta, intg);
  }
  const vals = years.map((y) => byYear[y]).filter(isNum);
  return { byYear, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN };
}

/** Ajuste de la base imponible para llevar el indicador a la mediana. */
export function baseImponible(
  pli: PLIName, mediana: number, v: number, c: number, s: number,
  activosOp: number, via: "costos" | "ingresos"
): number | null {
  if (!isNum(mediana) || !isNum(v) || !isNum(c)) return null;
  const sv = isNum(s) ? s : 0;
  const ub = v - c, uo = v - c - sv, m = mediana;
  let aj = NaN;
  if (pli.startsWith("Margen Operativo / Ventas"))
    aj = via === "costos" ? m * v - uo : Math.abs(1 - m) < 1e-12 ? NaN : (c + sv) / (1 - m) - v;
  else if (pli.startsWith("Margen Neto / Costos Totales")) {
    if (via === "costos") { if (Math.abs(1 + m) < 1e-12) return null; aj = c - (v - sv * (1 + m)) / (1 + m); }
    else aj = (1 + m) * (c + sv) - v;
  } else if (pli.startsWith("Margen Bruto / Ventas"))
    aj = via === "costos" ? m * v - ub : Math.abs(1 - m) < 1e-12 ? NaN : c / (1 - m) - v;
  else if (pli.startsWith("Margen Bruto / Costos")) {
    if (via === "costos") { if (Math.abs(1 + m) < 1e-12) return null; aj = c - v / (1 + m); }
    else aj = c * (1 + m) - v;
  } else if (pli.startsWith("Margen Operativo / Activos")) {
    if (!isNum(activosOp)) return null; aj = m * activosOp - uo;
  } else return null;
  return isNum(aj) ? aj : null;
}

const isAnul = (anul: Set<string>, ric: string, y: number) => anul.has(`${ric}\t${y}`);

/** Rango sin ajustar sobre las aceptadas, respetando años anulados. */
export function computeRange(
  rows: CompRow[], pli: PLIName, years: number[], anul: Set<string> = new Set()
): { comps: { ric: string; empresa: string; byYear: number[]; avg: number }[] } & RangeStats {
  const comps: { ric: string; empresa: string; byYear: number[]; avg: number }[] = [];
  for (const r of rows) {
    if (!r.accepted) continue;
    const per = years.filter((y) => !isAnul(anul, r.ric, y)).map((y) => r.vals[pli]?.[y]).filter(isNum);
    if (!per.length) continue;
    comps.push({
      ric: r.ric, empresa: r.empresa,
      byYear: years.map((y) => r.vals[pli]?.[y] ?? NaN),
      avg: per.reduce((a, b) => a + b, 0) / per.length,
    });
  }
  return { comps, ...rangeOf(comps.map((c) => c.avg)) };
}

/** Rango ajustado por capital de trabajo, respetando años anulados. */
export function computeAdjustedRange(
  rows: CompRow[], pli: PLIName, years: number[],
  tp: TestedByYear, rates: Record<number, number>, esServicios: boolean,
  anul: Set<string> = new Set()
): { comps: { ric: string; empresa: string; byYear: number[]; avg: number }[] } & RangeStats {
  const comps: { ric: string; empresa: string; byYear: number[]; avg: number }[] = [];
  for (const r of rows) {
    if (!r.accepted || !r.fin) continue;
    const { byYear } = adjustComparable(r.fin, years, pli, tp, rates, esServicios);
    for (const y of years) if (isAnul(anul, r.ric, y)) byYear[y] = NaN;
    const vals = years.map((y) => byYear[y]).filter(isNum);
    if (!vals.length) continue;
    comps.push({
      ric: r.ric, empresa: r.empresa,
      byYear: years.map((y) => byYear[y] ?? NaN),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    });
  }
  return { comps, ...rangeOf(comps.map((c) => c.avg)) };
}

/** Indicador de la empresa analizada: SIEMPRE el último año (más reciente) con resultados. */
export function testedIndicator(
  pli: PLIName, tp: TestedByYear, years: number[]
): { pli: number; year: number | null; base: Partial<Fin> } {
  for (const y of years) {
    const t = tp[y] || {};
    const r = ratioPLI(pli, t.V ?? NaN, t.C ?? NaN, t.S ?? NaN, t.TA ?? NaN, t.INT ?? NaN);
    if (isNum(r)) return { pli: r, year: y, base: t };
  }
  return { pli: NaN, year: null, base: {} };
}
