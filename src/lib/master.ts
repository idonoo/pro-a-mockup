import type { BomKey, MasterRow, Spec } from "./types";

export const BOM_KEYS: BomKey[] = ["steel", "glue", "pe", "moisture", "masterbatch"];

// 16 sizes Ø300–Ø3000. TIS (มอก.) only covers Ø300–Ø1500.
export const SIZES = [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2200, 2400, 2700, 3000];
export const TIS_MAX = 1500;
export const sizesFor = (spec: Spec) => (spec === "tis" ? SIZES.filter((d) => d <= TIS_MAX) : SIZES);

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Starting values. Only Ø300 (steel 1.94 / PE 2.45 kg/m) comes from the meeting example; the rest are scaled MOCK values. */
export function defaultMaster(): Record<Spec, Record<number, MasterRow>> {
  const row = (d: number): MasterRow => {
    const f = Math.pow(d / 300, 1.7);
    return d === 300 ? { steel: 1.94, pe: 2.45 } : { steel: r2(1.94 * f), pe: r2(2.45 * f) };
  };
  return {
    tis: Object.fromEntries(sizesFor("tis").map((d) => [d, row(d)])),
    innovation: Object.fromEntries(sizesFor("innovation").map((d) => [d, row(d)])),
  };
}

export const GLUE_PCT = 0.1;
export const PE_SHARE = 0.89;
export const MOISTURE_PCT = 0.055;
export const MASTERBATCH_PCT = 0.055;

export const DEFAULT_PRICE: Record<BomKey, number> = {
  steel: 30,
  glue: 80,
  pe: 45,
  moisture: 60,
  masterbatch: 120,
};
