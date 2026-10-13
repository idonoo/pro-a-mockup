import { AddMaterialForm } from "@/components/MaterialForms";
import { MasterEditor } from "@/components/MasterEditor";
import { ResetButton, SettingsForm } from "@/components/OrderForms";
import { PageHeader, Tbc } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { fmt, makeT, matName } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function SettingsPage() {
  await requireUser("exec");
  const t = makeT(await getLang());
  const db = (await loadDb());
  return (
    <>
      <PageHeader title={t("nav.settings")} />

      <section className="card mb-6">
        <h2 className="mb-4 text-2xl font-bold">{t("set.commission")}</h2>
        <SettingsForm initial={db.settings} />
        <div className="mt-5"><Tbc>{t("set.tbc")}</Tbc></div>
      </section>

      <section className="card mb-6">
        <h2 className="mb-1 text-2xl font-bold">{t("mm.title")}</h2>
        <p className="mb-4 text-base text-slate-500">{t("mm.sub")}</p>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t("rc.material")}</th>
                <th className="th">{t("mm.category")}</th>
                <th className="th">{t("mm.unit")}</th>
                <th className="th">{t("mm.altUnit")}</th>
                <th className="th text-right">{t("stock.onHand")}</th>
                <th className="th text-right">{t("stock.avgPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {db.materials.map((m) => (
                <tr key={m.key}>
                  <td className="td font-bold">{matName(t, m.key, db.materials)}{m.custom && m.nameEn && t.lang === "th" ? <span className="ml-2 text-base font-normal text-slate-500">{m.nameEn}</span> : null}</td>
                  <td className="td">{t(`mm.cat.${m.category}`)}</td>
                  <td className="td">{m.unit}</td>
                  <td className="td">{m.altUnit ? `1 ${t.lang === "en" ? m.altUnit.en : m.altUnit.th} = ${fmt(m.altUnit.factor)} ${m.unit}` : "—"}</td>
                  <td className="td text-right">{fmt(m.onHand)}</td>
                  <td className="td text-right">{fmt(m.avgPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-3 text-xl font-bold">{t("mm.addTitle")}</h3>
        <AddMaterialForm />
      </section>

      <section className="card mb-6">
        <h2 className="mb-1 text-2xl font-bold">{t("master.title")}</h2>
        <p className="mb-4 text-base text-slate-500">{t("master.sub")}</p>
        <MasterEditor master={db.master} log={db.masterLog} />
      </section>

      <section className="card">
        <h2 className="mb-2 text-2xl font-bold">{t("set.demo")}</h2>
        <p className="mb-4 text-lg text-slate-600">{t("set.demoHint")}</p>
        <ResetButton />
      </section>
    </>
  );
}
