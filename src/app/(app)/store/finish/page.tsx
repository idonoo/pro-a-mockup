import Link from "next/link";
import { FgForm } from "@/components/OrderForms";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fdt, fmt, makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function Finish() {
  await requireUser("store");
  const t = makeT(await getLang());
  const db = (await loadDb());
  const list = db.orders.filter((o) => o.status === "qc_done");
  const fg = db.orders.filter((o) => o.fg);
  return (
    <>
      <PageHeader title={t("nav.finish")} sub={t("finish.sub")} />
      <div className="flex flex-col gap-6">
        {list.map((o) => {
          return (
            <section key={o.id} className="card border-2 border-violet-300">
              <Link href={`/orders/${o.id}`} className="text-2xl font-bold text-blue-800 underline">{o.id}</Link>
              <div className="text-xl">Ø{o.diameter} · {t(`spec.${o.spec}`)} · {fmt(o.pieceLength)} m × {fmt(o.pieceCount, 0)} {t("pieces")} · {o.customer}</div>
              <div className="mt-5 max-w-md">
                <h3 className="mb-3 text-2xl font-bold">{t("act.fgTitle")}</h3>
                <FgForm orderId={o.id} pieces={o.pieceCount} />
              </div>
            </section>
          );
        })}
        {list.length === 0 && <p className="text-xl text-slate-500">{t("empty")}</p>}
      </div>

      <section className="card mt-8 overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("fg.stock")}</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("o.id")}</th>
              <th className="th">{t("f.size")} / {t("f.spec")}</th>
              <th className="th text-right">{t("f.pieceLength")}</th>
              <th className="th text-right">{t("fg.pieces")}</th>
              <th className="th text-right">{t("fg.value")}</th>
              <th className="th">{t("rc.date")}</th>
            </tr>
          </thead>
          <tbody>
            {fg.map((o) => (
              <tr key={o.id}>
                <td className="td font-bold"><Link href={`/orders/${o.id}`} className="text-blue-800 underline">{o.id}</Link></td>
                <td className="td">Ø{o.diameter} · {t(`spec.${o.spec}`)}</td>
                <td className="td text-right">{fmt(o.pieceLength)} m</td>
                <td className="td text-right">{fmt(o.fg!.pieces, 0)}</td>
                <td className="td text-right">{fmt(o.fg!.saleValue)}</td>
                <td className="td">{fdt(o.fg!.receivedAt)}</td>
              </tr>
            ))}
            {fg.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={6}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
