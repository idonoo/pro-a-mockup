import { notFound } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/ui";
import { loadDb } from "@/lib/db";
import { makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";

export default async function EditOrder({ params }: PageProps<"/orders/[id]/edit">) {
  const user = await requireUser("sales");
  const { id } = await params;
  const o = (await loadDb()).orders.find((x) => x.id === id);
  if (!o || o.salesId !== user.id || o.status !== "rejected") notFound();
  const t = makeT(await getLang());
  const { customer, poRef, diameter, spec, totalLength, pieceLength, pieceCount, price, expenses, deliveryDate, paymentDate, attachments } = o;
  return (
    <>
      <PageHeader title={`${t("form.edit")} ${o.id}`} sub={`${t("o.rejectReason")}: ${o.rejectReason}`} />
      <OrderForm
        orderId={o.id}
        initial={{ customer, poRef, diameter, spec, totalLength, pieceLength, pieceCount, price, expenses, deliveryDate, paymentDate, attachments }}
      />
    </>
  );
}
