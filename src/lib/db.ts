import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PRICE, BOM_KEYS, defaultMaster } from "./master";
import type { Db, OrderInput, User } from "./types";
import * as wf from "./workflow";

// A tiny JSON-file "database" so state survives restarts and is shared between route handlers and pages.
const FILE = path.join(process.cwd(), ".data", "db.json");

const USERS: User[] = [
  { id: "u-sales1", name: "Somchai (สมชาย)", role: "sales" },
  { id: "u-sales2", name: "Malee (มาลี)", role: "sales" },
  { id: "u-approver", name: "Wichai (วิชัย)", role: "approver" },
  { id: "u-production", name: "Prasert (ประเสริฐ)", role: "production" },
  { id: "u-store", name: "Suda (สุดา)", role: "store" },
  { id: "u-purchasing", name: "Preecha (ปรีชา)", role: "purchasing" },
  { id: "u-exec", name: "Khun Boss (คุณบอส)", role: "exec" },
];

const STOCK: Record<string, number> = { steel: 9000, glue: 1000, pe: 12000, moisture: 800, masterbatch: 1000 };

function blank(): Db {
  return {
    seq: 0,
    users: USERS,
    materials: BOM_KEYS.map((key) => ({
      key,
      onHand: STOCK[key],
      reserved: 0,
      avgPrice: DEFAULT_PRICE[key],
      unit: "kg",
      category: "bom" as const,
      altUnit: key === "glue" ? { th: "ถุง", en: "bag", factor: 25 } : undefined, // TBC with customer
    })),
    receipts: [],
    suppliers: [
      { id: "s1", name: "Thai Steel Co." },
      { id: "s2", name: "Adhesive Supply" },
      { id: "s3", name: "PE Resin Ltd." },
      { id: "s4", name: "Color & Additive Co." },
      { id: "s5", name: "Bangkok Steel Trading" },
    ],
    priceChanges: [],
    dailyScrap: [],
    master: defaultMaster(),
    masterLog: [],
    orders: [],
    settings: { commissionBase: "sales", rateSales: 3, rateNet: 10, commissionTrigger: "payment", approverSeesCost: false },
  };
}

function seed(): Db {
  const db = blank();
  const u = (id: string) => db.users.find((x) => x.id === id)!;
  const [s1, s2, ap, pr, st] = ["u-sales1", "u-sales2", "u-approver", "u-production", "u-store"].map(u);
  const today = new Date();
  const plus = (d: number) => new Date(today.getTime() + d * 864e5).toISOString().slice(0, 10);
  const file = (n: string) => [{ name: n, size: 240_000 }];
  const mk = (
    user: User,
    customer: string,
    diameter: number,
    spec: "tis" | "innovation",
    pieceLength: number,
    pieceCount: number,
    price: number,
    specFee: number,
    transportFee: number,
    poRef: string,
  ): string => {
    const input: OrderInput = {
      customer, poRef, diameter, spec, pieceLength, pieceCount,
      totalLength: pieceLength * pieceCount, price,
      expenses: [{ name: "ค่าสเปค", amount: specFee }, { name: "ค่าขนส่ง", amount: transportFee }],
      deliveryDate: plus(30), paymentDate: plus(60), attachments: file(`${poRef}.pdf`),
    };
    const r = wf.createOrder(db, user, input);
    if (!r.ok) throw new Error(r.errors.join());
    return r.id!;
  };
  const order = (id: string) => db.orders.find((o) => o.id === id)!;
  const approveAndIssue = (id: string) => {
    wf.approveOrder(db, ap, id);
    wf.requestIssue(db, pr, id, order(id).bom!.required);
    wf.issueMaterial(db, st, id, "IS-1");
  };

  const a = mk(s1, "Siam Drainage Co.", 300, "tis", 10, 20, 60_000, 1_000, 2_000, "PO-A-0912");
  approveAndIssue(a);
  wf.startProduction(db, pr, a);
  wf.finishProduction(db, pr, a);
  wf.receiveFG(db, st, a, 20);
  wf.deliver(db, s1, a);
  wf.receivePayment(db, s1, a);

  const b = mk(s1, "Bangkok Metro Works", 300, "tis", 10, 170, 500_000, 10_000, 15_000, "PO-B-1044");
  approveAndIssue(b);
  wf.startProduction(db, pr, b);

  const c = mk(s2, "Chiang Mai Irrigation", 400, "innovation", 10, 50, 300_000, 8_000, 9_000, "PO-C-2210");
  wf.approveOrder(db, ap, c);

  mk(s2, "Eastern Seaboard Project", 800, "tis", 10, 150, 5_000_000, 60_000, 90_000, "PO-D-0007");
  wf.approveOrder(db, ap, db.orders[0].id);

  mk(s1, "Khon Kaen Municipality", 1000, "tis", 6, 100, 1_800_000, 30_000, 40_000, "PO-E-3301");

  const f = mk(s2, "Rayong Industrial Estate", 600, "tis", 10, 30, 450_000, 5_000, 12_000, "PO-F-0450");
  approveAndIssue(f);
  wf.startProduction(db, pr, f);
  wf.finishProduction(db, pr, f);

  const g = mk(s1, "Phuket Water Dept.", 500, "tis", 10, 10, 120_000, 2_000, 4_000, "PO-G-0188");
  wf.rejectOrder(db, ap, g, "ระยะตัดท่อนไม่ตรงกับใบยืนยัน / cut length does not match the confirmation");

  const h = mk(s2, "Nakhon Pathom Farm", 500, "tis", 10, 10, 130_000, 2_000, 3_000, "PO-H-0521");
  approveAndIssue(h);
  wf.startProduction(db, pr, h);
  wf.finishProduction(db, pr, h);
  wf.receiveFG(db, st, h, 10);

  // standard prices (purchasing) and goods receipts (warehouse — no prices)
  const pu = u("u-purchasing");
  const day = today.toISOString().slice(0, 10);
  const std: [string, string, number][] = [["steel", "s1", 30], ["glue", "s2", 80], ["pe", "s3", 45], ["moisture", "s4", 60], ["masterbatch", "s4", 120]];
  for (const [material, supplierId, price] of std) wf.setStdPrice(db, pu, { material, supplierId, price });
  wf.receiveMaterial(db, st, { material: "steel", qty: 500, unit: "kg", date: day, poNo: "PO-S-2401", supplierId: "s1", lot: "L-2410-01" });
  wf.receiveMaterial(db, st, { material: "glue", qty: 40, unit: "ถุง", date: day, poNo: "PO-G-2402", supplierId: "s2", lot: "L-2410-02" });
  wf.receiveMaterial(db, st, { material: "pe", qty: 2000, unit: "kg", date: day, poNo: "PO-P-2403", supplierId: "s3", lot: "L-2410-03" });
  wf.receiveMaterial(db, st, { material: "steel", qty: 200, unit: "kg", date: day, poNo: "PO-S-2404", supplierId: "s5", lot: "L-2410-04" }); // supplier without a standard price yet
  wf.setStdPrice(db, pu, { material: "steel", supplierId: "s1", price: 32 }); // price rise, waiting for the executive

  // daily scrap (production)
  const ago = (d: number) => new Date(today.getTime() - d * 864e5).toISOString().slice(0, 10);
  wf.saveDailyScrap(db, pr, { date: ago(2), steelKg: 18, plasticKg: 9, poRefs: [a], fg: [{ diameter: 300, spec: "tis", pieces: 20, meters: 200 }] });
  wf.saveDailyScrap(db, pr, { date: ago(1), steelKg: 25, plasticKg: 12, poRefs: [b, f], fg: [] });

  return db;
}

/** Bring a db.json written by an older version up to the current shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(db: any): Db {
  const fresh = blank();
  delete db.costChanges; // per-receipt cost flow replaced by standard prices
  db.priceChanges ??= [];
  db.suppliers ??= [];
  db.dailyScrap ??= [];
  db.masterLog ??= [];
  db.master ??= defaultMaster();
  if (!db.users.some((u: User) => u.role === "purchasing")) db.users.splice(5, 0, USERS.find((u) => u.role === "purchasing")!);
  for (const m of db.materials) {
    m.unit ??= "kg";
    m.category ??= m.custom ? "other" : "bom";
    if (m.key === "glue" && !m.altUnit) m.altUnit = fresh.materials.find((x) => x.key === "glue")!.altUnit;
  }
  for (const r of db.receipts) {
    if (!r.supplierId && r.supplier) {
      let sup = db.suppliers.find((x: { name: string }) => x.name.toLowerCase() === r.supplier.toLowerCase());
      if (!sup) db.suppliers.push((sup = { id: `s${db.suppliers.length + 1}`, name: r.supplier }));
      r.supplierId = sup.id;
    }
    r.supplier ??= "";
    r.date ??= r.at.slice(0, 10);
    r.poNo ??= "";
    if ("pricePerKg" in r) {
      r.cost ??= r.pricePerKg; // costs that used to be typed by the warehouse stay on record
      delete r.pricePerKg;
    }
    if (r.enteredUnit === "bag") r.enteredUnit = "ถุง";
  }
  for (const o of db.orders) {
    // per-order scrap moved to production's daily scrap: fold old entries into daily records
    for (const sc of o.scrap ?? []) {
      const date = sc.at.slice(0, 10);
      let d = db.dailyScrap.find((x: { date: string }) => x.date === date);
      if (!d) db.dailyScrap.push((d = { id: `SC-${String(db.dailyScrap.length + 1).padStart(4, "0")}`, date, by: sc.by, at: sc.at, steelKg: 0, plasticKg: 0, poRefs: [], fg: [], edits: [] }));
      d.steelKg += sc.steelKg;
      d.plasticKg += sc.plasticKg;
      if (!d.poRefs.includes(o.id)) d.poRefs.push(o.id);
    }
    delete o.scrap;
    if (!o.expenses) {
      o.expenses = [
        { name: "ค่าสเปค", amount: o.specFee ?? 0 },
        { name: "ค่าขนส่ง", amount: o.transportFee ?? 0 },
      ].filter((x) => x.amount);
      delete o.specFee;
      delete o.transportFee;
    }
    // one open request per order: keep only the newest open one
    const open = o.issues.filter((i: { status: string }) => i.status === "requested");
    for (const i of open.slice(0, -1)) i.status = "cancelled";
  }
  return db as Db;
}

export function loadDb(): Db {
  try {
    return migrate(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    const db = seed();
    saveDb(db);
    return db;
  }
}

export function saveDb(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function resetDb() {
  saveDb(seed());
}

export function mutate<T>(fn: (db: Db) => T): T {
  const db = loadDb();
  const r = fn(db);
  saveDb(db);
  return r;
}
