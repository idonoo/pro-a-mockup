import Link from "next/link";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";
import { financials } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fdate, fmt, makeT } from "@/lib/i18n-core";
import { canSeeCost, canSeePrice, getLang, requireUser } from "@/lib/session";
import type { OrderStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = ["pending_approval", "rejected", "waiting_material", "waiting_production", "in_production", "qc_done", "ready", "delivered", "completed"];

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("sales", "approver", "exec");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "";
  const mine = user.role === "sales";
  const all = db.orders.filter((o) => !mine || o.salesId === user.id);
  const rows = filter ? all.filter((o) => o.status === filter) : all;
  const price = canSeePrice(user.role);
  const cost = canSeeCost(user.role, db.settings);
  const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;

  const fin = all.map((o) => financials(o, db.settings));
  const earned = fin.reduce((s, f) => s + (f.counted && f.earned ? f.commission : 0), 0);
  const pending = fin.reduce((s, f) => s + (f.counted && !f.earned ? f.commission : 0), 0);

  return (
    <>
      <PageHeader
        title={mine ? t("nav.myOrders") : t("nav.allOrders")}
        right={
          mine && (
            <Link href="/orders/new" className="btn btn-primary min-h-16 px-8 text-xl">
              + {t("nav.newOrder")}
            </Link>
          )
        }
      />

      {mine && (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Stat label={t("sum.orders")} value={all.length} />
          <Stat label={t("sum.inProduction")} value={all.filter((o) => ["waiting_material", "waiting_production", "in_production", "qc_done"].includes(o.status)).length} tone="blue" />
          <Stat label={t("sum.commEarned")} value={fmt(earned)} tone="green" sub={t("baht")} />
          <Stat label={t("sum.commPending")} value={fmt(pending)} tone="amber" sub={t("baht")} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/orders" className={`rounded-full border-2 px-4 py-1 text-base font-semibold ${!filter ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"}`}>
          {t("all")} ({all.length})
        </Link>
        {STATUSES.map((s) => {
          const n = all.filter((o) => o.status === s).length;
          if (!n) return null;
          return (
            <Link key={s} href={`/orders?status=${s}`} className={`rounded-full border-2 px-4 py-1 text-base font-semibold ${filter === s ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"}`}>
              {t(`status.${s}`)} ({n})
            </Link>
          );
        })}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("o.id")}</th>
              <th className="th">{t("f.customer")}</th>
              {!mine && <th className="th">{t("o.sales")}</th>}
              <th className="th">{t("f.size")} / {t("f.spec")}</th>
              <th className="th text-right">{t("f.totalLength")}</th>
              {price && <th className="th text-right">{t("f.price")}</th>}
              {cost && <th className="th text-right">{t("fin.net")}</th>}
              {mine && <th className="th text-right">{t("fin.commission")}</th>}
              <th className="th">{t("f.deliveryDate")}</th>
              <th className="th">{t("o.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const f = financials(o, db.settings);
              return (
                <tr key={o.id} className="hover:bg-blue-50">
                  <td className="td whitespace-nowrap font-bold">
                    <Link href={`/orders/${o.id}`} className="text-blue-800 underline">{o.id}</Link>
                  </td>
                  <td className="td">{o.customer}</td>
                  {!mine && <td className="td">{nameOf(o.salesId)}</td>}
                  <td className="td">Ø{o.diameter} · {t(`spec.${o.spec}`)}</td>
                  <td className="td text-right">{fmt(o.totalLength)} m</td>
                  {price && <td className="td text-right">{fmt(o.price)}</td>}
                  {cost && <td className="td text-right">{f.counted ? fmt(f.net) : "—"}{f.counted && f.isEstimate ? "*" : ""}</td>}
                  {mine && (
                    <td className="td text-right">
                      {f.counted ? (
                        <>
                          {fmt(f.commission)}
                          <div className={`text-sm font-semibold ${f.earned ? "text-emerald-700" : "text-amber-700"}`}>{f.earned ? t("comm.earned") : t("comm.pending")}</div>
                        </>
                      ) : "—"}
                    </td>
                  )}
                  <td className="td whitespace-nowrap">{fdate(o.deliveryDate)}</td>
                  <td className="td"><StatusBadge status={o.status} t={t} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td className="td text-center text-slate-500" colSpan={10}>{t("empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {cost && <p className="mt-2 text-base text-slate-500">* {t("fin.estNote")}</p>}
    </>
  );
}
