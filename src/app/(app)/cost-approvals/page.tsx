import { ActionButton } from "@/components/ActionButton";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fdate, fdt, fmt, makeT, matName, unitOf } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function PriceApprovals() {
  await requireUser("exec");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const sup = (id?: string) => db.suppliers.find((x) => x.id === id)?.name ?? "—";
  const pending = db.priceChanges.filter((c) => c.status === "pending");
  const history = db.priceChanges.filter((c) => c.status !== "pending").reverse();
  return (
    <>
      <PageHeader title={t("nav.costApprovals")} sub={t("costAppr.sub")} />

      <h2 className="mb-3 text-2xl font-bold">{t("cost.pendingTitle")} ({pending.length})</h2>
      <div className="mb-10 grid gap-4 md:grid-cols-2">
        {pending.map((c) => {
          const unit = unitOf(c.material, db.materials);
          const name = matName(t, c.material, db.materials);
          const switched = c.oldSupplierId && c.oldSupplierId !== c.supplierId;
          const lines = [
            name,
            `${t("std.price")}: ${fmt(c.oldPrice)} → ${fmt(c.newPrice)} / ${unit}`,
            `${t("std.supplier")}: ${switched ? `${sup(c.oldSupplierId)} → ${sup(c.supplierId)}` : sup(c.supplierId)}`,
            `${t("cost.requestedBy")}: ${c.requestedBy}`,
          ];
          return (
            <div key={c.id} className="card border-2 border-amber-300">
              <div className="text-2xl font-bold text-blue-800">{name}</div>
              <div className="mt-2 text-3xl font-bold">{fmt(c.oldPrice)} → {fmt(c.newPrice)} <span className="text-lg font-normal">/ {unit}</span></div>
              <div className="mt-1 text-xl">{switched ? `${sup(c.oldSupplierId)} → ${sup(c.supplierId)}` : sup(c.supplierId)}</div>
              <div className="mt-1 text-base text-slate-500">{c.requestedBy} · {fdt(c.requestedAt)}</div>
              <p className="mt-2 text-base text-slate-600">{t("costAppr.impact")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton url="/api/prices" body={{ action: "approve", id: c.id }} label={t("act.approve")} variant="green" confirm={{ title: t("confirm.costApprove"), lines }} />
                <ActionButton url="/api/prices" body={{ action: "reject", id: c.id }} label={t("act.reject")} variant="red" confirm={{ title: t("confirm.costReject"), lines, warning: t("confirm.irreversible"), danger: true }} />
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <p className="text-xl text-slate-500">{t("empty")}</p>}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("std.log")}</h2>
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
            {history.slice(0, 20).map((c) => (
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
            {history.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={8}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
