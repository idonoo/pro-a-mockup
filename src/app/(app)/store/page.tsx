import Link from "next/link";
import { ReceiveMaterialForm } from "@/components/OrderForms";
import { PageHeader } from "@/components/ui";
import { r2 } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fdate, fmt, makeT, matName, unitOf } from "@/lib/i18n-core";
import { BOM_KEYS } from "@/lib/master";
import { canSeeUnitCost, getLang, requireUser } from "@/lib/session";

export default async function Store() {
  const user = await requireUser("store", "exec", "purchasing");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const showCost = canSeeUnitCost(user.role); // the warehouse never sees prices
  const waiting = db.orders.filter((o) => o.status === "waiting_material");
  const shortage = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(waiting.reduce((s, o) => s + (o.shortage?.[k] ?? 0), 0))]));
  const anyShort = BOM_KEYS.some((k) => shortage[k] > 0);

  return (
    <>
      <PageHeader title={t("nav.stock")} sub={t("stock.sub")} />

      {anyShort && (
        <div className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
          <h2 className="text-2xl font-bold text-red-800">⚠ {t("stock.alert")}</h2>
          <p className="mt-1 text-xl">{BOM_KEYS.filter((k) => shortage[k] > 0).map((k) => `${t(`mat.${k}`)} ${fmt(shortage[k])} kg`).join(" · ")}</p>
          <p className="mt-2 text-lg">
            {t("stock.alertOrders")}:{" "}
            {waiting.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="mr-3 font-bold text-blue-800 underline">{o.id}</Link>
            ))}
          </p>
        </div>
      )}

      <div className="card mb-6 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.material")}</th>
              <th className="th">{t("mm.unit")}</th>
              <th className="th text-right">{t("stock.onHand")}</th>
              <th className="th text-right">{t("stock.reserved")}</th>
              <th className="th text-right">{t("stock.available")}</th>
              <th className="th text-right">{t("stock.short")}</th>
              {showCost && <th className="th text-right">{t("stock.avgPrice")}</th>}
            </tr>
          </thead>
          <tbody>
            {db.materials.map((m) => (
              <tr key={m.key}>
                <td className="td font-bold">
                  {matName(t, m.key, db.materials)}
                  {m.custom && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-semibold text-slate-700">{t("mm.custom")}</span>}
                </td>
                <td className="td">{m.unit}</td>
                <td className="td text-right">{fmt(m.onHand)}</td>
                <td className="td text-right">{fmt(m.reserved)}</td>
                <td className="td text-right font-bold text-emerald-700">{fmt(r2(m.onHand - m.reserved))}</td>
                <td className={`td text-right font-bold ${shortage[m.key] > 0 ? "text-red-700" : "text-slate-400"}`}>{m.custom ? "—" : fmt(shortage[m.key])}</td>
                {showCost && <td className="td text-right">{fmt(m.avgPrice)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-base text-slate-500">{t("stock.glossary")}</p>
      </div>

      {user.role === "store" && (
        <section className="card mb-6">
          <h2 className="mb-1 text-2xl font-bold">{t("rc.title")}</h2>
          <p className="mb-4 text-base text-slate-500">{t("rc.noPrice")}</p>
          <ReceiveMaterialForm
            suppliers={db.suppliers}
            materials={db.materials.map((m) => ({
              key: m.key,
              name: matName(t, m.key, db.materials),
              unit: m.unit,
              alt: m.altUnit ? { name: t.lang === "en" ? m.altUnit.en : m.altUnit.th, factor: m.altUnit.factor } : undefined,
            }))}
          />
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("rc.log")}</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.id")}</th>
              <th className="th">{t("rc.date")}</th>
              <th className="th">{t("rc.material")}</th>
              <th className="th text-right">{t("rc.qty")}</th>
              <th className="th text-right">{t("rc.baseQty")}</th>
              <th className="th">{t("rc.poNo")}</th>
              <th className="th">{t("rc.supplier")}</th>
              <th className="th">{t("rc.lot")}</th>
              {showCost && <th className="th text-right">{t("cost.cost")}</th>}
            </tr>
          </thead>
          <tbody>
            {db.receipts.slice(0, 15).map((r) => (
              <tr key={r.id}>
                <td className="td font-semibold">{r.id}</td>
                <td className="td whitespace-nowrap">{fdate(r.date)}</td>
                <td className="td">{matName(t, r.material, db.materials)}</td>
                <td className="td text-right">{fmt(r.enteredQty)} {r.enteredUnit}</td>
                <td className="td text-right">{fmt(r.qtyKg)} {unitOf(r.material, db.materials)}</td>
                <td className="td">{r.poNo || "—"}</td>
                <td className="td">{r.supplier || "—"}</td>
                <td className="td">{r.lot || "—"}</td>
                {showCost && <td className="td text-right">{r.cost === undefined ? <span className="text-amber-700">{t("cost.noStd")}</span> : fmt(r.cost)}</td>}
              </tr>
            ))}
            {db.receipts.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={9}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
