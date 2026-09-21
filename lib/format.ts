export const fmtPct = (v: number): string =>
  v == null || Number.isNaN(v) ? "—" : (v * 100).toFixed(2).replace(".", ",") + "%";

export const fmtNum = (v: number): string =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const parseNum = (raw: unknown): number => {
  if (raw == null || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  const f = parseFloat(String(raw).replace("%", "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isNaN(f) ? NaN : f;
};
