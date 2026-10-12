import { GLUE_PCT, MASTERBATCH_PCT, BOM_KEYS, MOISTURE_PCT, PE_SHARE, SIZES, TIS_MAX } from "./master";
import type { Bom, MasterRow, Material, Order, OrderInput, Qty, Settings } from "./types";

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const emptyQty = (): Qty => ({ steel: 0, glue: 0, pe: 0, moisture: 0, masterbatch: 0 });

/** Flow 2, steps 1–3: kg of each material per metre (rounded to 2 dp like the Excel). */
export function perMeter(m: MasterRow) {
  const plasticTotal = m.pe / PE_SHARE;
  const q: Qty = {
    steel: m.steel,
    glue: r2(m.steel * GLUE_PCT),
    pe: m.pe,
    moisture: r2(plasticTotal * MOISTURE_PCT),
    masterbatch: r2(plasticTotal * MASTERBATCH_PCT),
  };
  return { ...q, total: r2(BOM_KEYS.reduce((s, k) => s + q[k], 0)) };
}

/** Flow 2, steps 4–5: required kg for the whole order and estimated cost. */
export function calcBom(row: MasterRow, totalLength: number, avgPrice?: Record<string, number>): Bom {
  const pm = perMeter(row);
  const required = emptyQty();
  const estCost = emptyQty();
  for (const k of BOM_KEYS) {
    required[k] = r2(pm[k] * totalLength);
    estCost[k] = r2(required[k] * (avgPrice?.[k] ?? 0));
  }
  return {
    perMeter: pm,
    required,
    requiredTotal: r2(BOM_KEYS.reduce((s, k) => s + required[k], 0)),
    estCost,
    estCostTotal: r2(BOM_KEYS.reduce((s, k) => s + estCost[k], 0)),
  };
}

export const avgPriceMap = (mats: Material[]) => Object.fromEntries(mats.map((m) => [m.key, m.avgPrice]));

/** Flow 1 "ข้อมูลครบและถูกต้อง?" rules. Returns i18n error keys. */
export function validateOrder(i: OrderInput): string[] {
  const e: string[] = [];
  if (!i.customer?.trim()) e.push("err.customer");
  if (!SIZES.includes(i.diameter)) e.push("err.size");
  else if (i.spec === "tis" && i.diameter > TIS_MAX) e.push("err.tisRange");
  if (!(i.pieceLength > 0) || !(i.pieceCount > 0) || !Number.isInteger(i.pieceCount)) e.push("err.pieces");
  if (!(i.totalLength > 0)) e.push("err.total");
  else if (i.pieceLength > 0 && i.pieceCount > 0 && Math.abs(i.pieceLength * i.pieceCount - i.totalLength) > 0.001)
    e.push("err.totalMismatch");
  if (!i.attachments?.length) e.push("err.attachment");
  if ((i.expenses ?? []).some((x) => !x.name?.trim() || !(x.amount >= 0) || Number.isNaN(x.amount))) e.push("err.expense");
  if (!(i.price > 0)) e.push("err.price");
  if (!i.deliveryDate) e.push("err.deliveryDate");
  return e;
}

const PRODUCTION_DONE = ["qc_done", "ready", "delivered", "completed"];

export function actualCost(o: Order): number {
  return r2(o.issues.reduce((s, i) => s + (i.costTotal ?? 0), 0));
}

/** Flow 4: cost / profit / commission for a single order. */
export function financials(o: Order, s: Settings) {
  const isEstimate = !PRODUCTION_DONE.includes(o.status);
  const cost = isEstimate ? (o.bom?.estCostTotal ?? 0) : actualCost(o);
  const sales = o.price;
  const gross = r2(sales - cost);
  const expenses = r2((o.expenses ?? []).reduce((s, x) => s + x.amount, 0));
  const net = r2(gross - expenses);
  const base = s.commissionBase === "sales" ? sales : net;
  const rate = s.commissionBase === "sales" ? s.rateSales : s.rateNet;
  const commission = r2(Math.max(0, base) * (rate / 100));
  const passed = !["pending_approval", "rejected"].includes(o.status);
  const earned =
    s.commissionTrigger === "approval"
      ? passed
      : s.commissionTrigger === "delivery"
        ? o.status === "delivered" || o.status === "completed"
        : o.status === "completed";
  return { cost, isEstimate, sales, gross, expenses, net, commission, rate, earned, counted: passed };
}
