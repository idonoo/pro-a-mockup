"use client";
import { useState } from "react";
import { BOM_KEYS } from "@/lib/master";
import { fmt } from "@/lib/i18n-core";
import type { Amounts, Qty } from "@/lib/types";
import { ActionButton, useRun } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

export function RejectForm({ orderId }: { orderId: string }) {
  const t = useT();
  const run = useRun();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <label className="label">{t("act.rejectReason")}</label>
      <textarea className="input min-h-28" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <ConfirmButton
          label={t("act.reject")}
          variant="red"
          disabled={!reason.trim()}
          spec={{ title: t("confirm.rejectOrder"), lines: [orderId, `${t("act.rejectReason")}: ${reason.trim()}`], warning: t("confirm.irreversible"), danger: true }}
          run={run(`/api/orders/${orderId}/action`, { action: "reject", reason })}
        />
      </div>
    </div>
  );
}

export type ExtraMaterial = { key: string; name: string; unit: string; onHand: number };

export function IssueRequestForm({
  orderId,
  remaining,
  extras,
  open,
}: {
  orderId: string;
  remaining: Qty;
  extras: ExtraMaterial[];
  open?: { id: string; items: Amounts; approval: string };
}) {
  const t = useT();
  const run = useRun();
  const init = (k: string) => String(open ? (open.items[k] ?? "") : ((remaining as Record<string, number>)[k] ?? ""));
  const [q, setQ] = useState<Record<string, string>>(Object.fromEntries([...BOM_KEYS, ...extras.map((e) => e.key)].map((k) => [k, init(k)])));
  const editing = !!open && open.approval !== "approved";
  const replacing = !!open && open.approval === "approved";
  const items = Object.fromEntries([...BOM_KEYS, ...extras.map((e) => e.key)].map((k) => [k, Number(q[k]) || 0]));
  const lines = [
    orderId,
    ...BOM_KEYS.filter((k) => items[k] > 0).map((k) => `${t(`mat.${k}`)} ${fmt(items[k])} kg`),
    ...extras.filter((e) => items[e.key] > 0).map((e) => `${e.name} ${fmt(items[e.key])} ${e.unit}`),
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-slate-600">{replacing ? t("issue.hintNew", { id: open!.id }) : editing ? t("issue.hintEdit", { id: open!.id }) : t("issue.hint")}</p>
      <div className="grid gap-4 md:grid-cols-5">
        {BOM_KEYS.map((k) => (
          <div key={k}>
            <label className="label">{t(`mat.${k}`)} (kg)</label>
            <input className="input" type="number" min={0} step="any" value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      {extras.length > 0 && (
        <>
          <div>
            <h4 className="text-lg font-bold">{t("issue.extraTitle")}</h4>
            <p className="text-base text-slate-500">{t("issue.extraHint")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            {extras.map((e) => (
              <div key={e.key}>
                <label className="label">{e.name} ({e.unit})</label>
                <input className="input" type="number" min={0} step="any" placeholder="0" value={q[e.key] ?? ""} onChange={(ev) => setQ({ ...q, [e.key]: ev.target.value })} />
                <div className="mt-1 text-sm text-slate-500">{t("stock.onHand")}: {fmt(e.onHand)} {e.unit}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <div>
        <ConfirmButton
          label={replacing ? t("act.newRequest") : editing ? t("act.editRequest") : t("act.requestIssue")}
          spec={{
            title: replacing ? t("confirm.newRequest") : editing ? t("confirm.editRequest") : t("confirm.requestIssue"),
            lines,
            warning: replacing ? t("confirm.supersede", { id: open!.id }) : undefined,
          }}
          run={run(`/api/orders/${orderId}/action`, { action: "request_issue", items })}
        />
      </div>
    </div>
  );
}

export function FgForm({ orderId, pieces }: { orderId: string; pieces: number }) {
  const t = useT();
  const run = useRun();
  const [p, setP] = useState(String(pieces));
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <label className="label">{t("fg.pieces")}</label>
        <input className="input" type="number" min={1} step={1} value={p} onChange={(e) => setP(e.target.value)} />
      </div>
      <div>
        <ConfirmButton
          label={t("act.receiveFg")}
          variant="green"
          spec={{ title: t("confirm.fg"), lines: [orderId, `${t("fg.pieces")}: ${fmt(Number(p) || 0, 0)}`] }}
          run={run(`/api/orders/${orderId}/action`, { action: "receive_fg", pieces: Number(p) })}
        />
      </div>
    </div>
  );
}

export type MaterialOption = { key: string; name: string; unit: string; alt?: { name: string; factor: number } };

/** Warehouse: goods receipt without any price. Purchasing adds the cost later. */
export function ReceiveMaterialForm({ materials, suppliers }: { materials: MaterialOption[]; suppliers: { id: string; name: string }[] }) {
  const t = useT();
  const run = useRun();
  const today = new Date().toISOString().slice(0, 10);
  const [material, setMaterial] = useState(materials[0].key);
  const [qty, setQty] = useState("");
  const cur = materials.find((m) => m.key === material)!;
  const [unit, setUnit] = useState(cur.unit);
  const [date, setDate] = useState(today);
  const [poNo, setPoNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lot, setLot] = useState("");
  const pick = (k: string) => {
    setMaterial(k);
    setUnit(materials.find((m) => m.key === k)!.unit);
  };
  const conv = unit !== cur.unit && cur.alt ? ` (= ${fmt(Number(qty || 0) * cur.alt.factor)} ${cur.unit})` : "";
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div>
        <label className="label">{t("rc.material")}</label>
        <select className="input" value={material} onChange={(e) => pick(e.target.value)}>
          {materials.map((m) => (
            <option key={m.key} value={m.key}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("rc.qty")}</label>
        <input className="input" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("rc.unit")}</label>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value={cur.unit}>{cur.unit}</option>
          {cur.alt && <option value={cur.alt.name}>{cur.alt.name} (1 = {fmt(cur.alt.factor)} {cur.unit})</option>}
        </select>
      </div>
      <div>
        <label className="label">{t("rc.date")}</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("rc.poNo")}</label>
        <input className="input" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("rc.supplier")}</label>
        <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">{t("rc.pickSupplier")}</option>
          {suppliers.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("rc.lot")}</label>
        <input className="input" value={lot} onChange={(e) => setLot(e.target.value)} />
      </div>
      <div className="md:col-span-3">
        <ConfirmButton
          label={t("act.receiveMaterial")}
          variant="green"
          spec={{
            title: t("confirm.receive"),
            lines: [`${cur.name}: ${fmt(Number(qty) || 0)} ${unit}${conv}`, `${t("rc.date")}: ${date}`, `${t("rc.poNo")}: ${poNo || "—"}`, `${t("rc.supplier")}: ${suppliers.find((x) => x.id === supplierId)?.name ?? "—"} · ${t("rc.lot")}: ${lot || "—"}`],
          }}
          run={run("/api/materials/receive", { material, qty: Number(qty), unit, date, poNo, supplierId, lot }, { after: () => { setQty(""); setLot(""); setPoNo(""); } })}
        />
      </div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: { commissionBase: string; rateSales: number; rateNet: number; commissionTrigger: string; approverSeesCost: boolean } }) {
  const t = useT();
  const run = useRun();
  const [v, setV] = useState({ ...initial, rateSales: String(initial.rateSales), rateNet: String(initial.rateNet) });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="label">{t("set.base")}</label>
        <select className="input" value={v.commissionBase} onChange={(e) => setV({ ...v, commissionBase: e.target.value })}>
          <option value="sales">{t("set.baseSales")}</option>
          <option value="net">{t("set.baseNet")}</option>
        </select>
      </div>
      <div>
        <label className="label">{t("set.trigger")}</label>
        <select className="input" value={v.commissionTrigger} onChange={(e) => setV({ ...v, commissionTrigger: e.target.value })}>
          <option value="approval">{t("set.trigApproval")}</option>
          <option value="delivery">{t("set.trigDelivery")}</option>
          <option value="payment">{t("set.trigPayment")}</option>
        </select>
      </div>
      <div>
        <label className="label">{t("set.rateSales")}</label>
        <input className="input" type="number" min={0} step="any" value={v.rateSales} onChange={(e) => setV({ ...v, rateSales: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("set.rateNet")}</label>
        <input className="input" type="number" min={0} step="any" value={v.rateNet} onChange={(e) => setV({ ...v, rateNet: e.target.value })} />
      </div>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 text-lg font-semibold md:col-span-2">
        <input type="checkbox" className="size-6" checked={v.approverSeesCost} onChange={(e) => setV({ ...v, approverSeesCost: e.target.checked })} />
        {t("set.approverCost")}
      </label>
      <div className="md:col-span-2">
        <ConfirmButton
          label={t("save")}
          spec={{
            title: t("confirm.settings"),
            lines: [
              `${t("set.base")}: ${v.commissionBase === "sales" ? t("set.baseSales") : t("set.baseNet")}`,
              `${t("set.trigger")}: ${t(`set.trig.${v.commissionTrigger}`)}`,
              `${t("set.rateSales")}: ${v.rateSales}% · ${t("set.rateNet")}: ${v.rateNet}%`,
              `${t("set.approverCost")}: ${v.approverSeesCost ? t("yes") : t("no")}`,
            ],
          }}
          run={run("/api/settings", v, { method: "PUT" })}
        />
      </div>
    </div>
  );
}

export function ResetButton() {
  const t = useT();
  return <ActionButton url="/api/reset" label={t("set.reset")} variant="red" confirm={{ title: t("set.resetConfirm"), warning: t("confirm.irreversible"), danger: true }} />;
}
