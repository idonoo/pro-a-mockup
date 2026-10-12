import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/ui";
import { makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function NewOrder() {
  await requireUser("sales");
  const t = makeT(await getLang());
  return (
    <>
      <PageHeader title={t("nav.newOrder")} sub={t("form.sub")} />
      <OrderForm />
    </>
  );
}
