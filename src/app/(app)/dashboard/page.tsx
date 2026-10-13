import Link from "next/link";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";
import { financials, r2 } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fmt, makeT, matName } from "@/lib/i18n-core";
import { BOM_KEYS } from "@/lib/master";
import { getLang, requireUser } from "@/lib/session";
import type { OrderStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = ["pending_approval", "waiting_material", "waiting_production", "in_production", "qc_done", "ready", "delivered", "completed", "rejected"];
const BAR: Record<OrderStatus, string> = {
  pending_approval: "bg-amber-500", rejected: "bg-red-500", waiting_material: "bg-orange-500", waiting_production: "bg-sky-500",
  in_production: "bg-blue-600", qc_done: "bg-violet-500", ready: "bg-teal-500", delivered: "bg-indigo-500", completed: "bg-emerald-600",
};

export default async function Dashboard() {
  await requireUser("exec");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const counted = db.orders.filter((o) => !["pending_approval", "rejected"].includes(o.status));
  const fins = counted.map((o) => financials(o, db.settings));
  const sum = (f: (x: ReturnType<typeof financials>) => number) => r2(fins.reduce((s, x) => s + f(x), 0));
  const sales = sum((x) => x.sales);
  const cost = sum((x) => x.cost);
  const net = sum((x) => x.net);
  const earned = sum((x) => (x.earned ? x.commission : 0));
  const pending = sum((x) => (x.earned ? 0 : x.commission));
  const maxCount = Math.max(1, ...STATUSES.map((s) => db.orders.filter((o) => o.status === s).length));

  const scrapSteel = r2(db.dailyScrap.reduce((s, x) => s + x.steelKg, 0));
  const scrapPlastic = r2(db.dailyScrap.reduce((s, x) => s + x.plasticKg, 0));
  const waiting = db.orders.filter((o) => o.status === "waiting_material");

  return (
    <>
      <PageHeader title={t("nav.dashboard")} sub={t("dash.sub")} />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("dash.orders")} value={db.orders.length} sub={`${db.orders.filter((o) => o.status === "pending_approval").length} ${t("status.pending_approval")}`} />
        <Stat label={t("dash.sales")} value={fmt(sales, 0)} tone="blue" sub={t("baht")} />
        <Stat label={t("dash.cost")} value={fmt(cost, 0)} sub={t("baht")} />
        <Stat label={t("dash.net")} value={fmt(net, 0)} tone={net >= 0 ? "green" : "red"} sub={`${t("baht")} · ${sales ? fmt((net / sales) * 100, 1) : 0}%`} />
        <Stat label={t("sum.commEarned")} value={fmt(earned, 0)} tone="green" sub={t("baht")} />
        <Stat label={t("sum.commPending")} value={fmt(pending, 0)} tone="amber" sub={t("baht")} />
        <Stat label={t("dash.scrapSteel")} value={`${fmt(scrapSteel)} kg`} />
        <Stat label={t("dash.scrapPlastic")} value={`${fmt(scrapPlastic)} kg`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-2xl font-bold">{t("dash.byStatus")}</h2>
          <div className="flex flex-col gap-3">
            {STATUSES.map((s) => {
              const n = db.orders.filter((o) => o.status === s).length;
              return (
                <Link key={s} href={`/orders?status=${s}`} className="flex items-center gap-4">
                  <div className="w-52 shrink-0 text-lg font-semibold">{t(`status.${s}`)}</div>
                  <div className="h-8 flex-1 rounded-lg bg-slate-100">
                    <div className={`h-8 rounded-lg ${BAR[s]}`} style={{ width: `${(n / maxCount) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-xl font-bold">{n}</div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-4 text-2xl font-bold">{t("dash.stock")}</h2>
          <div className="flex flex-col gap-4">
            {db.materials.map((m) => {
              const free = r2(m.onHand - m.reserved);
              return (
                <div key={m.key}>
                  <div className="flex justify-between text-lg"><b>{matName(t, m.key, db.materials)}</b><span>{fmt(free)} / {fmt(m.onHand)} {m.unit}</span></div>
                  <div className="mt-1 flex h-6 overflow-hidden rounded-lg bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${m.onHand ? (free / Math.max(m.onHand, 1)) * 100 : 0}%` }} />
                    <div className="bg-amber-400" style={{ width: `${m.onHand ? (m.reserved / Math.max(m.onHand, 1)) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-base text-slate-500"><span className="text-emerald-600">■</span> {t("stock.available")} &nbsp; <span className="text-amber-500">■</span> {t("stock.reserved")}</p>
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("dash.scrapDaily")}</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.date")}</th>
              <th className="th text-right">{t("scrap.steel")}</th>
              <th className="th text-right">{t("scrap.plastic")}</th>
              <th className="th">{t("scrap.notes")}</th>
              <th className="th">{t("scrap.recordedBy")}</th>
            </tr>
          </thead>
          <tbody>
            {db.dailyScrap.slice(0, 7).map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap font-semibold">{r.date}</td>
                <td className="td text-right">{fmt(r.steelKg)}</td>
                <td className="td text-right">{fmt(r.plasticKg)}</td>
                <td className="td text-base">
                  {r.poRefs.length > 0 && <div>{t("scrap.noteA")}: {r.poRefs.join(", ")}</div>}
                  {r.fg.length > 0 && <div>{t("scrap.noteB")}: {fmt(r.fg.reduce((s, l) => s + l.pieces, 0), 0)} {t("pieces")} / {fmt(r.fg.reduce((s, l) => s + l.meters, 0))} m</div>}
                  {r.poRefs.length === 0 && r.fg.length === 0 && "—"}
                </td>
                <td className="td">{r.by}</td>
              </tr>
            ))}
            {db.dailyScrap.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={5}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>

      {waiting.length > 0 && (
        <section className="card mt-6 border-2 border-orange-300">
          <h2 className="mb-3 text-2xl font-bold text-orange-900">⚠ {t("stock.alert")}</h2>
          {waiting.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-4 border-t border-slate-200 py-2 text-xl first:border-t-0">
              <Link href={`/orders/${o.id}`} className="font-bold text-blue-800 underline">{o.id}</Link>
              <StatusBadge status={o.status} t={t} />
              <span>{BOM_KEYS.filter((k) => (o.shortage?.[k] ?? 0) > 0).map((k) => `${t(`mat.${k}`)} ${fmt(o.shortage![k])}`).join(" · ")} kg</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
