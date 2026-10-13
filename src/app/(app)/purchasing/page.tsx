import Link from "next/link";
import { AddSupplierForm, StdPriceForm } from "@/components/PurchasingForms";
import { PageHeader } from "@/components/ui";
import { r2 } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fdate, fdt, fmt, makeT, matName, unitOf } from "@/lib/i18n-core";
import { BOM_KEYS } from "@/lib/master";
import { getLang, requireUser } from "@/lib/session";
import { activePrice, currentStandard } from "@/lib/workflow";

export default async function Purchasing() {
  await requireUser("purchasing");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const today = new Date().toISOString().slice(0, 10);
  const sup = (id?: string) => db.suppliers.find((x) => x.id === id)?.name ?? "—";

  const waiting = db.orders.filter((o) => o.status === "waiting_material");
  const shortage = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(waiting.reduce((s, o) => s + (o.shortage?.[k] ?? 0), 0))]));
  const need = BOM_KEYS.filter((k) => shortage[k] > 0);

  // materials with their current standard (for "old → new" lines in the confirm dialog)
  const matInfo = db.materials.map((m) => {
    const cur = currentStandard(db, m.key);
    return { key: m.key, name: matName(t, m.key, db.materials), unit: m.unit, hasPrice: !!cur, currentSupplier: cur ? sup(cur.supplierId) : undefined, currentPrice: cur?.newPrice };
  });
  const pendingFor = (material: string, supplierId: string) => db.priceChanges.find((p) => p.material === material && p.supplierId === supplierId && p.status === "pending");

  // receipts whose supplier has no standard price yet, grouped by material + supplier
  const unpriced = new Map<string, { material: string; supplierId: string; count: number; qty: number }>();
  for (const r of db.receipts) {
    if (r.cost !== undefined || !r.supplierId) continue;
    const k = `${r.material}|${r.supplierId}`;
    const g = unpriced.get(k) ?? { material: r.material, supplierId: r.supplierId, count: 0, qty: 0 };
    g.count++;
    g.qty += r.qtyKg;
    unpriced.set(k, g);
  }

  // current standard price per (material, supplier) pair
  const pairs = new Map<string, NonNullable<ReturnType<typeof activePrice>>>();
  for (const p of db.priceChanges) {
    if (p.status !== "approved") continue;
    const k = `${p.material}|${p.supplierId}`;
    const a = activePrice(db, p.material, p.supplierId, today);
    if (a && !pairs.has(k)) pairs.set(k, a);
  }
  const rows = [...pairs.values()].sort((a, b) => a.material.localeCompare(b.material) || sup(a.supplierId).localeCompare(sup(b.supplierId)));

  return (
    <>
      <PageHeader title={t("nav.purchasing")} sub={t("purch.sub")} />

      {need.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
          <h2 className="text-2xl font-bold text-red-800">⚠ {t("stock.alert")}</h2>
          <p className="mt-1 text-xl">{need.map((k) => `${t(`mat.${k}`)} ${fmt(shortage[k])} kg`).join(" · ")}</p>
          <p className="mt-2 text-lg">
            {t("stock.alertOrders")}:{" "}
            {waiting.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="mr-3 font-bold text-blue-800 underline">{o.id}</Link>
            ))}
          </p>
        </div>
      )}

      {unpriced.size > 0 && (
        <section className="card mb-6 border-2 border-amber-400 bg-amber-50">
          <h2 className="mb-1 text-2xl font-bold text-amber-900">⚠ {t("std.noPriceTitle")} ({unpriced.size})</h2>
          <p className="mb-4 text-base text-amber-900">{t("std.noPriceHint")}</p>
          <div className="flex flex-col gap-4">
            {[...unpriced.values()].map((g) => {
              const pend = pendingFor(g.material, g.supplierId);
              return (
                <div key={`${g.material}|${g.supplierId}`} className="rounded-xl bg-white p-4">
                  <div className="mb-2 text-xl font-bold">
                    {matName(t, g.material, db.materials)} · {sup(g.supplierId)}
                    <span className="ml-3 text-base font-normal text-slate-600">{g.count} {t("std.receipts")} · {fmt(g.qty)} {unitOf(g.material, db.materials)}</span>
                  </div>
                  <StdPriceForm
                    materials={matInfo}
                    suppliers={db.suppliers}
                    presetMaterial={g.material}
                    presetSupplier={g.supplierId}
                    disabledReason={pend ? t("cost.pendingBadge") : undefined}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card mb-6 overflow-x-auto">
        <h2 className="mb-1 text-2xl font-bold">{t("std.title")}</h2>
        <p className="mb-3 text-base text-slate-500">{t("std.hint")}</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.material")}</th>
              <th className="th">{t("std.supplier")}</th>
              <th className="th text-right">{t("std.price")}</th>
              <th className="th">{t("mm.unit")}</th>
              <th className="th">{t("std.effective")}</th>
              <th className="th">{t("std.requestChange")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const pend = pendingFor(p.material, p.supplierId);
              const isCurrent = currentStandard(db, p.material)?.id === p.id;
              return (
                <tr key={p.id}>
                  <td className="td font-bold">{matName(t, p.material, db.materials)}</td>
                  <td className="td">
                    {sup(p.supplierId)}
                    {isCurrent && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-800">{t("std.current")}</span>}
                  </td>
                  <td className="td text-right font-bold">{fmt(p.newPrice)}</td>
                  <td className="td">{unitOf(p.material, db.materials)}</td>
                  <td className="td whitespace-nowrap">{fdate(p.effectiveFrom)}</td>
                  <td className="td">
                    <StdPriceForm
                      compact
                      materials={matInfo}
                      suppliers={db.suppliers}
                      presetMaterial={p.material}
                      presetSupplier={p.supplierId}
                      disabledReason={pend ? t("cost.pendingBadge") : undefined}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={6}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card mb-6">
        <h2 className="mb-1 text-2xl font-bold">{t("std.addTitle")}</h2>
        <p className="mb-4 text-base text-slate-500">{t("std.addHint")}</p>
        <StdPriceForm materials={matInfo} suppliers={db.suppliers} />
        <div className="mt-6 border-t border-slate-200 pt-5">
          <AddSupplierForm />
          <p className="mt-2 text-base text-slate-500">{t("std.suppliers")}: {db.suppliers.map((x) => x.name).join(" · ")}</p>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("std.log")}</h2>
        <PriceLog />
      </section>
    </>
  );

  function PriceLog() {
    return (
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">{t("rc.date")}</th>
            <th className="th">{t("rc.material")}</th>
            <th className="th text-right">{t("std.price")}</th>
            <th className="th">{t("std.supplier")}</th>
            <th className="th">{t("cost.requestedBy")}</th>
            <th className="th">{t("cost.approvedBy")}</th>
            <th className="th">{t("std.effective")}</th>
            <th className="th">{t("o.status")}</th>
          </tr>
        </thead>
        <tbody>
          {[...db.priceChanges].reverse().slice(0, 20).map((c) => (
            <tr key={c.id}>
              <td className="td whitespace-nowrap">{fdt(c.requestedAt)}</td>
              <td className="td">{matName(t, c.material, db.materials)}</td>
              <td className="td text-right whitespace-nowrap">{c.oldPrice === undefined ? "—" : fmt(c.oldPrice)} → {fmt(c.newPrice)}</td>
              <td className="td">{c.oldSupplierId && c.oldSupplierId !== c.supplierId ? `${sup(c.oldSupplierId)} → ` : ""}{sup(c.supplierId)}</td>
              <td className="td">{c.requestedBy}</td>
              <td className="td">{c.kind === "initial" ? t("cost.noApproval") : (c.decidedBy ?? "—")}</td>
              <td className="td whitespace-nowrap">{fdate(c.effectiveFrom)}</td>
              <td className="td">{t(`cost.st.${c.status}`)}</td>
            </tr>
          ))}
          {db.priceChanges.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={8}>{t("empty")}</td></tr>}
        </tbody>
      </table>
    );
  }
}
