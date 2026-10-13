export type Role = "sales" | "approver" | "production" | "store" | "purchasing" | "exec";
export type Lang = "th" | "en";
export type Spec = "tis" | "innovation";
export type BomKey = "steel" | "glue" | "pe" | "moisture" | "masterbatch";
export type MaterialKey = string; // BomKey or a custom material key
export type Qty = Record<BomKey, number>; // BOM quantities (core 5 materials)
export type Amounts = Record<string, number>; // any material, sparse

export type OrderStatus =
  | "pending_approval"
  | "rejected"
  | "waiting_material"
  | "waiting_production"
  | "in_production"
  | "qc_done"
  | "ready"
  | "delivered"
  | "completed";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Attachment {
  name: string;
  size: number;
}

export interface Material {
  key: MaterialKey;
  onHand: number; // in `unit`
  reserved: number;
  avgPrice: number; // baht per unit
  unit: string; // base unit
  category: "bom" | "other" | "spare";
  altUnit?: { th: string; en: string; factor: number }; // e.g. 1 bag = 25 kg
  custom?: boolean; // added by purchasing / executive; not part of the BOM formulas
  nameTh?: string;
  nameEn?: string;
}

/** Warehouse books the receipt without a price; the cost comes from the standard price table (see PriceChange). */
export interface Receipt {
  id: string; // line id (RC-…)
  docId: string; // receipt document (GR-…): one document = one PO with many lines
  at: string;
  by: string;
  date: string; // date received
  material: MaterialKey;
  qtyKg: number; // quantity in the material's base unit
  enteredQty: number;
  enteredUnit: string;
  poNo: string;
  supplierId?: string;
  supplier: string; // supplier name at the time of receipt
  lot: string;
  cost?: number; // baht per base unit — taken automatically from the standard price in force on `date`
  priceId?: string; // which standard price it came from
}

export interface Supplier {
  id: string;
  name: string;
}

/** One entry of the standard-price history for a (material, supplier) pair. */
export interface PriceChange {
  id: string;
  kind: "initial" | "change"; // initial = first standard price of a material, no approval needed
  material: MaterialKey;
  supplierId: string;
  newPrice: number; // baht per base unit
  oldPrice?: number;
  oldSupplierId?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  effectiveFrom?: string; // date, set when approved (or at once for "initial")
}

export interface MasterRow {
  steel: number;
  pe: number;
}
export interface MasterLog {
  at: string;
  by: string;
  spec: Spec;
  diameter: number;
  field: "steel" | "pe";
  from: number;
  to: number;
}

export interface Issue {
  id: string;
  requestedAt: string;
  requestedBy: string;
  items: Amounts;
  overBom: boolean;
  approval: "none" | "pending" | "approved" | "rejected";
  status: "requested" | "issued" | "rejected" | "cancelled"; // cancelled = replaced by a newer request
  edits?: { at: string; by: string; from: Amounts; to: Amounts }[];
  issuedAt?: string;
  issuedBy?: string;
  cost?: Amounts;
  costTotal?: number;
}

export interface FgLine {
  diameter: number;
  spec: Spec;
  pieces: number;
  meters: number;
}
export interface ScrapSnapshot {
  steelKg: number;
  plasticKg: number;
  poRefs: string[]; // note type 1: POs produced that day
  fg: FgLine[]; // note type 2: finished goods produced
}
/** Production's daily scrap record — one per date, not tied to a PO. Notes are reference only. */
export interface DailyScrap extends ScrapSnapshot {
  id: string;
  date: string;
  by: string;
  at: string;
  edits: { at: string; by: string; from: ScrapSnapshot; to: ScrapSnapshot }[];
}

export interface Bom {
  perMeter: Qty & { total: number };
  required: Qty;
  requiredTotal: number;
  estCost: Qty;
  estCostTotal: number;
}

export interface HistoryItem {
  at: string;
  by: string;
  action: string; // i18n key
  note?: string;
}

export interface Order {
  id: string;
  customer: string;
  poRef: string;
  salesId: string;
  diameter: number;
  spec: Spec;
  totalLength: number;
  pieceLength: number;
  pieceCount: number;
  price: number;
  expenses: Expense[];
  deliveryDate: string;
  paymentDate: string;
  attachments: Attachment[];
  status: OrderStatus;
  createdAt: string;
  rejectReason?: string;
  bom?: Bom;
  shortage?: Qty;
  reservedRemaining?: Qty;
  issues: Issue[];
  fg?: { receivedAt: string; pieces: number; saleValue: number };
  deliveredAt?: string;
  paidAt?: string;
  history: HistoryItem[];
}

export interface Expense {
  name: string;
  amount: number;
}

export interface Settings {
  commissionBase: "sales" | "net";
  rateSales: number;
  rateNet: number;
  commissionTrigger: "approval" | "delivery" | "payment";
  approverSeesCost: boolean;
}

export interface Db {
  seq: number;
  users: User[];
  materials: Material[];
  receipts: Receipt[];
  suppliers: Supplier[];
  priceChanges: PriceChange[];
  dailyScrap: DailyScrap[];
  master: Record<Spec, Record<number, MasterRow>>;
  masterLog: MasterLog[];
  orders: Order[];
  settings: Settings;
}

export interface OrderInput {
  customer: string;
  poRef: string;
  diameter: number;
  spec: Spec;
  totalLength: number;
  pieceLength: number;
  pieceCount: number;
  price: number;
  expenses: Expense[];
  deliveryDate: string;
  paymentDate: string;
  attachments: Attachment[];
}
