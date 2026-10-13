import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fdate, fmt, makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";
import type { OrderStatus } from "@/lib/types";

const COLS: { status: OrderStatus; hint: string }[] = [
  { status: "waiting_material", hint: "prod.hintWaitMat" },
  { status: "waiting_production", hint: "prod.hintWaiting" },
  { status: "in_production", hint: "prod.hintIn" },
  { status: "qc_done", hint: "prod.hintQc" },
];

export default async function Production() {
  await requireUser("production");
  const t = makeT(await getLang());
  const db = (await loadDb());
  return (
    <>
      <PageHeader title={t("nav.production")} sub={t("prod.sub")} />
      <div className="grid gap-6 xl:grid-cols-4">
        {COLS.map(({ status, hint }) => {
          const list = db.orders.filter((o) => o.status === status);
          return (
            <section key={status} className="flex flex-col gap-3">
              <div>
                <h2 className="text-2xl font-bold">{t(`status.${status}`)} ({list.length})</h2>
                <p className="text-base text-slate-500">{t(hint)}</p>
              </div>
              {list.map((o) => {
                const clickable = status !== "waiting_material";
                const inner = (
                  <>
                    <div className="text-2xl font-bold text-blue-800">{o.id}</div>
                    <div className="text-lg">{o.customer}</div>
                    <div className="mt-2 text-xl font-semibold">Ø{o.diameter} · {t(`spec.${o.spec}`)}</div>
                    <div className="text-lg">{fmt(o.pieceLength)} m × {fmt(o.pieceCount, 0)} = {fmt(o.totalLength)} m</div>
                    <div className="mt-1 text-base text-slate-500">{t("f.deliveryDate")}: {fdate(o.deliveryDate)}</div>
                    <div className="mt-2"><StatusBadge status={o.status} t={t} /></div>
                  </>
                );
                return clickable ? (
                  <Link key={o.id} href={`/orders/${o.id}`} className="card border-2 border-blue-200 transition hover:border-blue-500 hover:shadow-md">{inner}</Link>
                ) : (
                  <div key={o.id} className="card opacity-70">{inner}</div>
                );
              })}
              {list.length === 0 && <p className="text-lg text-slate-400">—</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
