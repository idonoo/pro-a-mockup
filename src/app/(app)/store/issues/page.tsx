import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fdt, fmt, itemsText, makeT, matName, unitOf } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function IssuesPage() {
  await requireUser("store");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const list = db.orders.flatMap((o) => o.issues.filter((i) => i.status === "requested").map((i) => ({ o, i })));
  return (
    <>
      <PageHeader title={t("nav.issues")} sub={t("issues.sub")} />
      <div className="grid gap-5 md:grid-cols-2">
        {list.map(({ o, i }) => {
          const blocked = i.approval === "pending";
          const short = Object.keys(i.items).filter((k) => i.items[k] > 0 && (db.materials.find((m) => m.key === k)?.onHand ?? 0) < i.items[k]);
          return (
            <div key={o.id + i.id} className={`card border-2 ${blocked ? "border-orange-300" : "border-blue-300"}`}>
              <div className="flex items-center justify-between">
                <Link href={`/orders/${o.id}`} className="text-2xl font-bold text-blue-800 underline">{o.id} · {i.id}</Link>
                <span className="text-base text-slate-500">{fdt(i.requestedAt)}</span>
              </div>
              <div className="text-lg">Ø{o.diameter} · {t(`spec.${o.spec}`)} · {o.customer}</div>
              <table className="mt-3 w-full">
                <tbody>
                  {Object.keys(i.items).filter((k) => i.items[k] > 0).map((k) => (
                    <tr key={k}>
                      <td className="py-1 text-xl">{matName(t, k, db.materials)}</td>
                      <td className="py-1 text-right text-xl font-bold">{fmt(i.items[k])} {unitOf(k, db.materials)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {i.overBom && <p className="mt-2 text-lg font-semibold text-orange-700">{t("issue.over")} · {t(`issue.ap.${i.approval}`)}</p>}
              {short.length > 0 && <p className="mt-2 text-lg font-semibold text-red-700">{t("err.insufficientStock")}: {short.map((k) => matName(t, k, db.materials)).join(", ")}</p>}
              <div className="mt-4">
                {blocked ? <p className="text-lg text-orange-700">{t("issue.waitApproval")}</p> : <ActionButton url={`/api/orders/${o.id}/action`} body={{ action: "issue", issueId: i.id }} label={t("act.issue")} variant="green" confirm={{ title: t("confirm.issue"), lines: [`${o.id} · ${i.id}`, itemsText(t, i.items, db.materials)], warning: t("confirm.irreversible"), danger: true }} />}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-xl text-slate-500">{t("empty")}</p>}
      </div>
    </>
  );
}
