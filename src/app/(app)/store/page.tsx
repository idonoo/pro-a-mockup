import Link from "next/link";
import { ReceiveMaterialForm } from "@/components/OrderForms";
import { PageHeader } from "@/components/ui";
import { r2 } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fdate, fdt, fmt, makeT, matName, unitOf } from "@/lib/i18n-core";
import { BOM_KEYS } from "@/lib/master";
import { canSeeUnitCost, getLang, requireUser } from "@/lib/session";

export default async function Store() {
  const user = await requireUser("store", "exec", "purchasing");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const showCost = canSeeUnitCost(user.role); // the warehouse never sees prices
  const waiting = db.orders.filter((o) => o.status === "waiting_material");
  const shortage = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(waiting.reduce((s, o) => s + (o.shortage?.[k] ?? 0), 0))]));
  // receipts are booked as documents (one PO, many lines) — newest first
  const docMap = new Map<string, { id: string; date: string; poNo: string; supplier: string; by: string; at: string; lines: typeof db.receipts }>();
  for (const r of db.receipts) {
    const d = docMap.get(r.docId) ?? { id: r.docId, date: r.date, poNo: r.poNo, supplier: r.supplier, by: r.by, at: r.at, lines: [] };
    d.lines.unshift(r);
    docMap.set(r.docId, d);
  }
  const docs = [...docMap.values()].slice(0, 15);
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

      <section className="card">
        <h2 className="mb-3 text-2xl font-bold">{t("rc.docs")}</h2>
        <div className="flex flex-col gap-3">
          {docs.map((d, i) => (
            <details key={d.id} className="rounded-xl border border-slate-200 bg-white" open={i === 0}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-lg">
                <span className="font-bold">{d.id}</span>
                <span className="whitespace-nowrap">{fdate(d.date)}</span>
                <span>{t("rc.poNo")}: <b>{d.poNo || "—"}</b></span>
                <span>{d.supplier || "—"}</span>
                <span className="rounded-full bg-slate-200 px-3 py-0.5 text-base font-semibold">{d.lines.length} {t("rc.lines")}</span>
                {showCost && d.lines.some((r) => r.cost === undefined) && <span className="text-base font-semibold text-amber-700">{t("cost.noStd")}</span>}
              </summary>
              <div className="overflow-x-auto border-t border-slate-200 px-4 pb-3">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">{t("rc.id")}</th>
                      <th className="th">{t("rc.material")}</th>
                      <th className="th text-right">{t("rc.qty")}</th>
                      <th className="th text-right">{t("rc.baseQty")}</th>
                      <th className="th">{t("rc.lot")}</th>
                      {showCost && <th className="th text-right">{t("cost.cost")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((r) => (
                      <tr key={r.id}>
                        <td className="td font-semibold">{r.id}</td>
                        <td className="td">{matName(t, r.material, db.materials)}</td>
                        <td className="td text-right">{fmt(r.enteredQty)} {r.enteredUnit}</td>
                        <td className="td text-right">{fmt(r.qtyKg)} {unitOf(r.material, db.materials)}</td>
                        <td className="td">{r.lot || "—"}</td>
                        {showCost && <td className="td text-right">{r.cost === undefined ? <span className="text-amber-700">{t("cost.noStd")}</span> : fmt(r.cost)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-sm text-slate-500">{d.by} · {fdt(d.at)}</p>
              </div>
            </details>
          ))}
          {docs.length === 0 && <p className="text-center text-slate-500">{t("empty")}</p>}
        </div>
      </section>
    </>
  );
}
