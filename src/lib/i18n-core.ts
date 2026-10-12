import { dict } from "./dict";
import type { Lang, Material } from "./types";

export type TFn = ((key: string, vars?: Record<string, string | number>) => string) & { lang: Lang };

export function makeT(lang: Lang): TFn {
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dict[lang][key] ?? dict.th[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
  return Object.assign(t, { lang });
}

type MatLike = Pick<Material, "key" | "custom" | "nameTh" | "nameEn" | "unit">;

/** Display name of a material: translated for the core 5, user-entered for custom ones. */
export function matName(t: TFn, key: string, mats: MatLike[]): string {
  const m = mats.find((x) => x.key === key);
  if (m?.custom) return (t.lang === "en" ? m.nameEn || m.nameTh : m.nameTh) ?? key;
  return t(`mat.${key}`);
}
export const unitOf = (key: string, mats: MatLike[]) => mats.find((x) => x.key === key)?.unit ?? "kg";

/** "Steel 3,298 kg · Adhesive 323 kg" for an issue's items. */
export function itemsText(t: TFn, items: Record<string, number>, mats: MatLike[]): string {
  return Object.entries(items)
    .filter(([, q]) => q > 0)
    .map(([k, q]) => `${matName(t, k, mats)} ${fmt(q)} ${unitOf(k, mats)}`)
    .join(" · ");
}

export const fmt = (n: number | undefined, dp = 2) =>
  n === undefined || n === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: dp }).format(n);
export const fdate = (iso?: string) => (iso ? iso.slice(0, 10) : "—");
export const fdt = (iso?: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");
