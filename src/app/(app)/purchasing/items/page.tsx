import { AddMaterialForm } from "@/components/MaterialForms";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fmt, makeT, matName } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function Items() {
  await requireUser("purchasing");
  const t = makeT(await getLang());
  const db = loadDb();
  return (
    <>
      <PageHeader title={t("nav.items")} sub={t("items.sub")} />
      <section className="card mb-6">
        <h2 className="mb-4 text-2xl font-bold">+ {t("mm.addTitle")}</h2>
        <AddMaterialForm />
      </section>
      <section className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.material")}</th>
              <th className="th">{t("mm.category")}</th>
              <th className="th">{t("mm.unit")}</th>
              <th className="th">{t("mm.altUnit")}</th>
              <th className="th text-right">{t("stock.onHand")}</th>
            </tr>
          </thead>
          <tbody>
            {db.materials.map((m) => (
              <tr key={m.key}>
                <td className="td font-bold">
                  {matName(t, m.key, db.materials)}
                  {m.custom && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-semibold text-slate-700">{t("mm.custom")}</span>}
                </td>
                <td className="td">{t(`mm.cat.${m.category}`)}</td>
                <td className="td">{m.unit}</td>
                <td className="td">{m.altUnit ? `1 ${t.lang === "en" ? m.altUnit.en : m.altUnit.th} = ${fmt(m.altUnit.factor)} ${m.unit}` : "—"}</td>
                <td className="td text-right">{fmt(m.onHand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
