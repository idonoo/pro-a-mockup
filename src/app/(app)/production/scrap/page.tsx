import { DailyScrapForm } from "@/components/DailyScrapForm";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function ScrapPage() {
  await requireUser("production");
  const t = makeT(await getLang());
  const db = loadDb();
  const day = (o: (typeof db.orders)[number], action: string) => o.history.find((h) => h.action === action)?.at.slice(0, 10);
  const orders = db.orders
    .filter((o) => day(o, "h.started"))
    .map((o) => ({ id: o.id, diameter: o.diameter, spec: o.spec, pieceCount: o.pieceCount, totalLength: o.totalLength, startedDate: day(o, "h.started"), finishedDate: day(o, "h.qcDone") }));
  return (
    <>
      <PageHeader title={t("nav.scrap")} sub={t("scrap.pageSub")} />
      <DailyScrapForm records={db.dailyScrap} orders={orders} today={new Date().toISOString().slice(0, 10)} />
    </>
  );
}
