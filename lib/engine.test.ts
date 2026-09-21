import { describe, it, expect } from "vitest";
import { quantileInc, ratioPLI, adjustComparable, baseImponible } from "./engine";

describe("quantileInc (PERCENTILE.INC)", () => {
  it("coincide con Excel/pandas en [1,2,3,4]", () => {
    expect(quantileInc([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
    expect(quantileInc([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(quantileInc([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 10);
  });
  it("min y max exactos (entrada ordenada)", () => {
    expect(quantileInc([1, 5, 9], 0)).toBe(1);
    expect(quantileInc([1, 5, 9], 1)).toBe(9);
  });
});

describe("ratioPLI", () => {
  it("Margen Operativo / Ventas", () => {
    expect(ratioPLI("Margen Operativo / Ventas", 2500, 1700, 300, 0, 0)).toBeCloseTo(0.2, 12);
  });
  it("Margen Bruto / Ventas", () => {
    expect(ratioPLI("Margen Bruto / Ventas", 1000, 650, 0, 0, 0)).toBeCloseTo(0.35, 12);
  });
  it("Margen Operativo / Activos usa (activos - intangibles)", () => {
    expect(ratioPLI("Margen Operativo / Activos", 1000, 650, 120, 1200, 200)).toBeCloseTo(230 / 1000, 12);
  });
});

describe("adjustComparable (capital de trabajo)", () => {
  it("caso verificado a mano contra el pipeline", () => {
    const fin = { 2024: { V: 1000, C: 650, S: 120, AR: 200, AP: 90, INV: 80, TA: 1200, INT: 0 } };
    const tp = { 2024: { V: 2500, AR: 600, AP: 250, INV: 180 } };
    const { byYear } = adjustComparable(fin, [2024], "Margen Operativo / Ventas", tp, { 2024: 0.06 }, false);
    // vn_aj=997.7359, cv_aj=649.91397 -> ratio 0.228336
    expect(byYear[2024]).toBeCloseTo(0.228336, 5);
  });
  it("es_servicios ignora el ajuste por inventarios", () => {
    const fin = { 2024: { V: 1000, C: 650, S: 120, AR: 200, AP: 90, INV: 80, TA: 1200, INT: 0 } };
    const tp = { 2024: { V: 2500, AR: 600, AP: 250, INV: 180 } };
    const conInv = adjustComparable(fin, [2024], "Margen Operativo / Ventas", tp, { 2024: 0.06 }, false).byYear[2024];
    const sinInv = adjustComparable(fin, [2024], "Margen Operativo / Ventas", tp, { 2024: 0.06 }, true).byYear[2024];
    expect(conInv).not.toBeCloseTo(sinInv, 6);
  });
});

describe("baseImponible", () => {
  it("Margen Operativo / Ventas vía costos = 16,37 (caso verificado)", () => {
    const aj = baseImponible("Margen Operativo / Ventas", 0.206548, 2500, 1700, 300, NaN, "costos");
    expect(aj).not.toBeNull();
    expect(aj as number).toBeCloseTo(16.37, 1);
  });
  it("vía ingresos difiere de vía costos", () => {
    const costos = baseImponible("Margen Operativo / Ventas", 0.206548, 2500, 1700, 300, NaN, "costos")!;
    const ingresos = baseImponible("Margen Operativo / Ventas", 0.206548, 2500, 1700, 300, NaN, "ingresos")!;
    expect(costos).not.toBeCloseTo(ingresos, 2);
  });
});
