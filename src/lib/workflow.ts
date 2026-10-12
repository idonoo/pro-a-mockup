import { dict } from "./dict";
import { avgPriceMap, calcBom, emptyQty, r2, validateOrder } from "./calc";
import { BOM_KEYS, SIZES, sizesFor } from "./master";
import type { Amounts, Db, FgLine, Issue, Material, MaterialKey, Order, OrderInput, PriceChange, Qty, Role, ScrapSnapshot, Spec, User } from "./types";

export type Result = { ok: true; id?: string } | { ok: false; errors: string[] };
const fail = (...errors: string[]): Result => ({ ok: false, errors });
const ok = (id?: string): Result => ({ ok: true, id });

const now = () => new Date().toISOString();
const mat = (db: Db, k: MaterialKey) => db.materials.find((m) => m.key === k)!;
const log = (o: Order, by: User, action: string, note?: string) => o.history.push({ at: now(), by: by.name, action, note });
const needRole = (u: User, ...roles: Role[]) => roles.includes(u.role);
const today = () => now().slice(0, 10);
const findOrder = (db: Db, id: string) => db.orders.find((o) => o.id === id);
const cleanExpenses = (i: OrderInput) =>
  (i.expenses ?? []).filter((x) => x.name?.trim() || x.amount).map((x) => ({ name: (x.name ?? "").trim(), amount: Number(x.amount) }));

// ---------------------------------------------------------------- Sales
export function createOrder(db: Db, user: User, input: OrderInput): Result {
  if (!needRole(user, "sales")) return fail("err.forbidden");
  input = { ...input, expenses: cleanExpenses(input) };
  const errors = validateOrder(input);
  if (errors.length) return fail(...errors);
  const id = `PO-${new Date().getFullYear()}-${String(++db.seq).padStart(4, "0")}`;
  const o: Order = {
    ...input,
    id,
    salesId: user.id,
    status: "pending_approval",
    createdAt: now(),
    issues: [],
    history: [],
  };
  log(o, user, "h.submitted");
  db.orders.unshift(o);
  return ok(id);
}

export function resubmitOrder(db: Db, user: User, id: string, input: OrderInput): Result {
  const o = findOrder(db, id);
  if (!o || o.salesId !== user.id || o.status !== "rejected") return fail("err.forbidden");
  input = { ...input, expenses: cleanExpenses(input) };
  const errors = validateOrder(input);
  if (errors.length) return fail(...errors);
  Object.assign(o, input, { status: "pending_approval", rejectReason: undefined });
  log(o, user, "h.resubmitted");
  return ok(id);
}

export function deliver(db: Db, user: User, id: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "sales") || o.salesId !== user.id || o.status !== "ready") return fail("err.forbidden");
  o.status = "delivered";
  o.deliveredAt = now();
  log(o, user, "h.delivered");
  return ok();
}

export function receivePayment(db: Db, user: User, id: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "sales") || o.salesId !== user.id || o.status !== "delivered") return fail("err.forbidden");
  o.status = "completed";
  o.paidAt = now();
  log(o, user, "h.paid");
  return ok();
}

// ------------------------------------------------------------- Approver
/** Flow 2 steps 6–7: check stock; reserve everything or put the order on hold. */
function tryReserve(db: Db, o: Order): boolean {
  const req = o.bom!.required;
  const shortage = emptyQty();
  let short = false;
  for (const k of BOM_KEYS) {
    const m = mat(db, k);
    const available = m.onHand - m.reserved;
    shortage[k] = r2(Math.max(0, req[k] - available));
    if (shortage[k] > 0) short = true;
  }
  o.shortage = shortage;
  if (short) {
    o.status = "waiting_material";
    return false;
  }
  for (const k of BOM_KEYS) mat(db, k).reserved = r2(mat(db, k).reserved + req[k]);
  o.reservedRemaining = { ...req };
  o.shortage = undefined;
  o.status = "waiting_production";
  return true;
}

export function approveOrder(db: Db, user: User, id: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "approver") || o.status !== "pending_approval") return fail("err.forbidden");
  const row = db.master[o.spec]?.[o.diameter]; // BOM uses the table of the order's spec
  if (!row) return fail("err.noMaster");
  o.bom = calcBom(row, o.totalLength, avgPriceMap(db.materials));
  log(o, user, "h.approved");
  const reserved = tryReserve(db, o);
  log(o, user, reserved ? "h.reserved" : "h.shortage");
  return ok();
}

export function rejectOrder(db: Db, user: User, id: string, reason: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "approver") || o.status !== "pending_approval") return fail("err.forbidden");
  if (!reason?.trim()) return fail("err.reason");
  o.status = "rejected";
  o.rejectReason = reason.trim();
  log(o, user, "h.rejected", reason.trim());
  return ok();
}

export function decideIssue(db: Db, user: User, id: string, issueId: string, approve: boolean): Result {
  const o = findOrder(db, id);
  const i = o?.issues.find((x) => x.id === issueId);
  if (!o || !i || !needRole(user, "approver") || i.approval !== "pending" || i.status !== "requested") return fail("err.forbidden");
  i.approval = approve ? "approved" : "rejected";
  if (!approve) i.status = "rejected";
  log(o, user, approve ? "h.issueApproved" : "h.issueRejected");
  return ok();
}

// ---------------------------------------------------------------- Store
/** Re-check every order waiting for material, oldest first. */
function recheckWaiting(db: Db) {
  const waiting = db.orders.filter((o) => o.status === "waiting_material").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const o of waiting) {
    if (tryReserve(db, o)) o.history.push({ at: now(), by: "System", action: "h.reserved" });
  }
}

// ----------------------------------------------------- Standard prices
/** Standard price in force for a material + supplier on a date (latest approved entry that started on or before it). */
export function activePrice(db: Db, material: MaterialKey, supplierId: string, date: string): PriceChange | undefined {
  const key = (p: PriceChange) => `${p.effectiveFrom}|${p.decidedAt ?? p.requestedAt}`;
  return db.priceChanges
    .filter((p) => p.material === material && p.supplierId === supplierId && p.status === "approved" && p.effectiveFrom && p.effectiveFrom <= date)
    .sort((a, b) => key(a).localeCompare(key(b)))
    .pop();
}

/** The material's current standard = its most recently approved entry. */
export function currentStandard(db: Db, material: MaterialKey): PriceChange | undefined {
  return db.priceChanges
    .filter((p) => p.material === material && p.status === "approved")
    .sort((a, b) => (a.decidedAt ?? a.requestedAt).localeCompare(b.decidedAt ?? b.requestedAt))
    .pop();
}

/** Receipts that were booked before their supplier had a standard price pick it up as soon as one exists. */
function backfillReceipts(db: Db, p: PriceChange) {
  for (const r of db.receipts) {
    if (r.cost !== undefined || r.material !== p.material || r.supplierId !== p.supplierId) continue;
    const m = mat(db, r.material);
    const before = Math.max(0, m.onHand - r.qtyKg);
    m.avgPrice = r2((before * m.avgPrice + r.qtyKg * p.newPrice) / Math.max(m.onHand, r.qtyKg));
    r.cost = p.newPrice;
    r.priceId = p.id;
  }
}

export function addSupplier(db: Db, user: User, name: string): Result {
  if (!needRole(user, "purchasing", "exec")) return fail("err.forbidden");
  const n = name?.trim();
  if (!n) return fail("err.supplierName");
  if (db.suppliers.some((x) => x.name.toLowerCase() === n.toLowerCase())) return fail("err.supplierDup");
  const id = `s${db.suppliers.length + 1}`;
  db.suppliers.push({ id, name: n });
  return ok(id);
}

/**
 * Purchasing sets / changes the standard price of a material for a supplier.
 *  - the material's very first price: effective at once, no approval
 *  - anything else (supplier raises the price, or switching supplier): pending until the executive approves; effective from approval date
 */
export function setStdPrice(db: Db, user: User, p: { material: MaterialKey; supplierId: string; price: number }): Result {
  if (!needRole(user, "purchasing")) return fail("err.forbidden");
  if (!db.materials.some((m) => m.key === p.material)) return fail("err.material");
  if (!db.suppliers.some((x) => x.id === p.supplierId)) return fail("err.supplier");
  if (!(p.price > 0)) return fail("err.price");
  const cur = currentStandard(db, p.material);
  if (cur && cur.supplierId === p.supplierId && cur.newPrice === p.price) return fail("err.noChange");
  if (db.priceChanges.some((x) => x.material === p.material && x.supplierId === p.supplierId && x.status === "pending")) return fail("err.costPending");
  const base = {
    id: `PR-${String(db.priceChanges.length + 1).padStart(4, "0")}`,
    material: p.material,
    supplierId: p.supplierId,
    newPrice: p.price,
    requestedBy: user.name,
    requestedAt: now(),
  };
  if (!cur) {
    const e: PriceChange = { ...base, kind: "initial", status: "approved", decidedAt: now(), effectiveFrom: today() };
    db.priceChanges.push(e);
    backfillReceipts(db, e);
    return ok(e.id);
  }
  db.priceChanges.push({ ...base, kind: "change", status: "pending", oldPrice: cur.newPrice, oldSupplierId: cur.supplierId });
  return ok(base.id);
}

export function decidePriceChange(db: Db, user: User, id: string, approve: boolean): Result {
  const p = db.priceChanges.find((x) => x.id === id);
  if (!p || !needRole(user, "exec") || p.status !== "pending") return fail("err.forbidden");
  p.status = approve ? "approved" : "rejected";
  p.decidedBy = user.name;
  p.decidedAt = now();
  if (approve) {
    p.effectiveFrom = today(); // new price counts from the approval date; earlier receipts keep their old cost
    backfillReceipts(db, p);
  }
  return ok();
}

/** Warehouse books goods in — no price. The cost is looked up from the standard price in force on the receipt date. */
export function receiveMaterial(
  db: Db,
  user: User,
  p: { material: MaterialKey; qty: number; unit: string; date: string; poNo: string; supplierId: string; lot: string },
): Result {
  if (!needRole(user, "store")) return fail("err.forbidden");
  const m = db.materials.find((x) => x.key === p.material);
  if (!m) return fail("err.material");
  const sup = db.suppliers.find((x) => x.id === p.supplierId);
  if (!sup) return fail("err.supplier");
  if (!(p.qty > 0)) return fail("err.qty");
  const alt = m.altUnit && (p.unit === m.altUnit.th || p.unit === m.altUnit.en) ? m.altUnit : undefined;
  if (!alt && p.unit !== m.unit) return fail("err.unit");
  const qtyBase = r2(alt ? p.qty * alt.factor : p.qty);
  const date = p.date || today();
  const price = activePrice(db, p.material, p.supplierId, date);
  if (price) m.avgPrice = m.onHand > 0 ? r2((m.onHand * m.avgPrice + qtyBase * price.newPrice) / (m.onHand + qtyBase)) : price.newPrice; // moving average (TBC)
  m.onHand = r2(m.onHand + qtyBase);
  db.receipts.unshift({
    id: `RC-${String(db.receipts.length + 1).padStart(4, "0")}`,
    at: now(),
    by: user.name,
    date,
    material: p.material,
    qtyKg: qtyBase,
    enteredQty: p.qty,
    enteredUnit: p.unit,
    poNo: p.poNo?.trim() ?? "",
    supplierId: sup.id,
    supplier: sup.name,
    lot: p.lot?.trim() ?? "",
    cost: price?.newPrice,
    priceId: price?.id,
  });
  recheckWaiting(db);
  return ok();
}

export function issueMaterial(db: Db, user: User, id: string, issueId: string): Result {
  const o = findOrder(db, id);
  const i = o?.issues.find((x) => x.id === issueId);
  if (!o || !i || !needRole(user, "store")) return fail("err.forbidden");
  if (i.status !== "requested" || i.approval === "pending" || i.approval === "rejected") return fail("err.issueNotReady");
  const keys = Object.keys(i.items).filter((k) => i.items[k] > 0);
  for (const k of keys) if (!mat(db, k) || mat(db, k).onHand < i.items[k]) return fail("err.insufficientStock");
  const cost: Amounts = {};
  for (const k of keys) {
    const q = i.items[k];
    const m = mat(db, k);
    cost[k] = r2(q * m.avgPrice);
    m.onHand = r2(m.onHand - q);
    if (!m.custom && o.reservedRemaining) {
      const bk = k as keyof Qty; // only the 5 BOM materials are reserved; custom ones are issued straight from stock
      const used = Math.min(q, o.reservedRemaining[bk] ?? 0);
      m.reserved = r2(m.reserved - used);
      o.reservedRemaining[bk] = r2(o.reservedRemaining[bk] - used);
    }
  }
  i.cost = cost;
  i.costTotal = r2(keys.reduce((s, k) => s + cost[k], 0));
  i.status = "issued";
  i.issuedAt = now();
  i.issuedBy = user.name;
  log(o, user, "h.issued");
  return ok();
}

export function receiveFG(db: Db, user: User, id: string, pieces: number): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "store") || o.status !== "qc_done") return fail("err.forbidden");
  if (!(pieces > 0) || !Number.isInteger(pieces)) return fail("err.pieces");
  o.fg = { receivedAt: now(), pieces, saleValue: o.price };
  o.status = "ready";
  log(o, user, "h.fgReceived");
  return ok();
}

// ----------------------------------------------------------- Production
/**
 * One open request per order.
 *  - open request still waiting for approval (or needing none): edit it in place and keep an edit log
 *  - open request already approved: cancel it and open a new one
 */
export function requestIssue(db: Db, user: User, id: string, items: Amounts): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "production") || !["waiting_production", "in_production"].includes(o.status)) return fail("err.forbidden");
  const q: Amounts = {};
  for (const m of db.materials) {
    const v = Math.max(0, Number(items?.[m.key]) || 0);
    if (v > 0) q[m.key] = v;
  }
  if (Object.keys(q).length === 0) return fail("err.qty");
  const issued = emptyQty();
  for (const i of o.issues) if (i.status === "issued") for (const k of BOM_KEYS) issued[k] += i.items[k] ?? 0;
  // Over-BOM only applies to the 5 BOM materials; custom materials have no BOM quantity to exceed
  const overBom = BOM_KEYS.some((k) => r2(issued[k] + (q[k] ?? 0)) > o.bom!.required[k]);
  const approval = overBom ? "pending" : "none";

  const open = o.issues.find((i) => i.status === "requested");
  if (open && open.approval !== "approved") {
    const keys = new Set([...Object.keys(open.items), ...Object.keys(q)]);
    if ([...keys].every((k) => (open.items[k] ?? 0) === (q[k] ?? 0))) return ok(open.id); // nothing changed
    (open.edits ??= []).push({ at: now(), by: user.name, from: open.items, to: q });
    open.items = q;
    open.overBom = overBom;
    open.approval = approval;
    log(o, user, "h.issueEdited");
    return ok(open.id);
  }
  if (open) {
    open.status = "cancelled";
    log(o, user, "h.issueSuperseded");
  }
  const issue: Issue = {
    id: `IS-${o.issues.length + 1}`,
    requestedAt: now(),
    requestedBy: user.name,
    items: q,
    overBom,
    approval,
    status: "requested",
  };
  o.issues.push(issue);
  log(o, user, overBom ? "h.issueRequestedOver" : "h.issueRequested");
  return ok(issue.id);
}

export function startProduction(db: Db, user: User, id: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "production") || o.status !== "waiting_production") return fail("err.forbidden");
  if (!o.issues.some((i) => i.status === "issued")) return fail("err.noIssue");
  o.status = "in_production";
  log(o, user, "h.started");
  return ok();
}

export function finishProduction(db: Db, user: User, id: string): Result {
  const o = findOrder(db, id);
  if (!o || !needRole(user, "production") || o.status !== "in_production") return fail("err.forbidden");
  // release whatever is still reserved for this job
  for (const k of BOM_KEYS) {
    const left = o.reservedRemaining?.[k] ?? 0;
    if (left > 0) mat(db, k).reserved = r2(mat(db, k).reserved - left);
  }
  if (o.reservedRemaining) o.reservedRemaining = emptyQty();
  o.status = "qc_done";
  log(o, user, "h.qcDone");
  return ok();
}

// ----------------------------------------------- Purchasing / Executive
export function addMaterial(
  db: Db,
  user: User,
  p: { nameTh: string; nameEn?: string; category?: Material["category"]; unit: string; altUnit?: string; factor?: number; price?: number },
): Result {
  if (!needRole(user, "exec", "purchasing", "store")) return fail("err.forbidden");
  const nameTh = p.nameTh?.trim();
  if (!nameTh) return fail("err.matName");
  const unit = p.unit?.trim();
  if (!unit) return fail("err.matUnit");
  const nameEn = p.nameEn?.trim() || undefined;
  const altName = p.altUnit?.trim();
  if (altName && !(Number(p.factor) > 0)) return fail("err.factor");
  const taken = new Set(
    db.materials.flatMap((m) => (m.custom ? [m.nameTh, m.nameEn] : [dict.th[`mat.${m.key}`], dict.en[`mat.${m.key}`]])).filter(Boolean).map((n) => n!.toLowerCase()),
  );
  if (taken.has(nameTh.toLowerCase()) || (nameEn && taken.has(nameEn.toLowerCase()))) return fail("err.matDup");
  const key = `x${db.materials.filter((m) => m.custom).length + 1}`;
  db.materials.push({
    key,
    custom: true,
    category: p.category && ["bom", "other", "spare"].includes(p.category) ? p.category : "other",
    nameTh,
    nameEn,
    unit,
    altUnit: altName ? { th: altName, en: altName, factor: Number(p.factor) } : undefined,
    onHand: 0,
    reserved: 0,
    avgPrice: Math.max(0, Number(p.price) || 0),
  });
  return ok(key);
}

/** Executive edits steel / PE kg-per-metre in the table of one spec. Everything else is derived. */
export function updateMaster(db: Db, user: User, spec: Spec, rows: { diameter: number; steel: number; pe: number }[]): Result {
  if (!needRole(user, "exec")) return fail("err.forbidden");
  if (!db.master[spec]) return fail("err.forbidden");
  const allowed = sizesFor(spec);
  let changed = 0;
  for (const r of rows) {
    if (!allowed.includes(r.diameter)) return fail("err.size");
    if (!(r.steel > 0) || !(r.pe > 0)) return fail("err.masterValue");
  }
  for (const r of rows) {
    const cur = db.master[spec][r.diameter];
    for (const f of ["steel", "pe"] as const) {
      if (cur[f] !== r[f]) {
        db.masterLog.unshift({ at: now(), by: user.name, spec, diameter: r.diameter, field: f, from: cur[f], to: r[f] });
        cur[f] = r[f];
        changed++;
      }
    }
  }
  return changed ? ok() : fail("err.noChange");
}

// ---------------------------------------------------- Production: scrap
const snap = (x: ScrapSnapshot): ScrapSnapshot => ({ steelKg: x.steelKg, plasticKg: x.plasticKg, poRefs: [...x.poRefs], fg: x.fg.map((l) => ({ ...l })) });

/** One record per day, not tied to a PO. Saving a date that already has a record edits it and logs old → new. */
export function saveDailyScrap(db: Db, user: User, p: { date: string; steelKg: number; plasticKg: number; poRefs: string[]; fg: FgLine[] }): Result {
  if (!needRole(user, "production")) return fail("err.forbidden");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? "") || p.date > today()) return fail("err.scrapDate");
  const steelKg = Number(p.steelKg) || 0;
  const plasticKg = Number(p.plasticKg) || 0;
  if (steelKg < 0 || plasticKg < 0 || steelKg + plasticKg <= 0) return fail("err.qty");
  const poRefs = [...new Set((p.poRefs ?? []).map((x) => String(x).trim()).filter(Boolean))];
  const fg: FgLine[] = [];
  for (const l of p.fg ?? []) {
    const spec: Spec = l.spec === "innovation" ? "innovation" : "tis";
    if (!SIZES.includes(Number(l.diameter)) || !sizesFor(spec).includes(Number(l.diameter)) || !(Number(l.pieces) > 0) || !Number.isInteger(Number(l.pieces)) || !(Number(l.meters) > 0)) return fail("err.fgLine");
    fg.push({ diameter: Number(l.diameter), spec, pieces: Number(l.pieces), meters: Number(l.meters) });
  }
  const next: ScrapSnapshot = { steelKg, plasticKg, poRefs, fg };
  const cur = db.dailyScrap.find((x) => x.date === p.date);
  if (cur) {
    if (JSON.stringify(snap(cur)) === JSON.stringify(next)) return fail("err.noChange");
    cur.edits.push({ at: now(), by: user.name, from: snap(cur), to: next });
    Object.assign(cur, next);
    return ok(cur.id);
  }
  const id = `SC-${String(db.dailyScrap.length + 1).padStart(4, "0")}`;
  db.dailyScrap.push({ id, date: p.date, by: user.name, at: now(), edits: [], ...next });
  db.dailyScrap.sort((a, b) => b.date.localeCompare(a.date));
  return ok(id);
}
