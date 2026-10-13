import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fdate, fmt, itemsText, makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function Approvals() {
  await requireUser("approver");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const pending = db.orders.filter((o) => o.status === "pending_approval");
  const issues = db.orders.flatMap((o) => o.issues.filter((i) => i.approval === "pending" && i.status === "requested").map((i) => ({ o, i })));
  const seller = (id: string) => db.users.find((u) => u.id === id)?.name ?? "";

  return (
    <>
      <PageHeader title={t("nav.approvals")} sub={t("appr.sub")} />

      <h2 className="mb-3 text-2xl font-bold">{t("appr.orders")} ({pending.length})</h2>
      <div className="mb-10 grid gap-4 md:grid-cols-2">
        {pending.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="card border-2 border-amber-300 transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="text-2xl font-bold text-blue-800">{o.id}</div>
              <div className="text-base text-slate-500">{fdate(o.createdAt)}</div>
            </div>
            <div className="mt-1 text-xl">{o.customer}</div>
            <div className="mt-2 text-xl font-semibold">Ø{o.diameter} · {t(`spec.${o.spec}`)} · {fmt(o.totalLength)} m</div>
            <div className="text-lg text-slate-600">{t("o.sales")}: {seller(o.salesId)} · 📎 {o.attachments.length}</div>
            <div className="btn btn-primary mt-4 w-full">{t("act.review")}</div>
          </Link>
        ))}
        {pending.length === 0 && <p className="text-xl text-slate-500">{t("empty")}</p>}
      </div>

      <h2 className="mb-3 text-2xl font-bold">{t("appr.issues")} ({issues.length})</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {issues.map(({ o, i }) => (
          <Link key={o.id + i.id} href={`/orders/${o.id}`} className="card border-2 border-orange-300 transition hover:shadow-md">
            <div className="text-2xl font-bold text-blue-800">{o.id} · {i.id}</div>
            <div className="mt-1 text-lg">{i.requestedBy}</div>
            <div className="mt-2 text-xl">{itemsText(t, i.items, db.materials)}</div>
            <div className="btn btn-primary mt-4 w-full">{t("act.review")}</div>
          </Link>
        ))}
        {issues.length === 0 && <p className="text-xl text-slate-500">{t("empty")}</p>}
      </div>
    </>
  );
}
