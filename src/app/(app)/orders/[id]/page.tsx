import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { FgForm, IssueRequestForm, RejectForm } from "@/components/OrderForms";
import { PageHeader, StatusBadge } from "@/components/ui";
import { financials, r2 } from "@/lib/calc";
import { loadDb } from "@/lib/db";
import { fdate, fdt, fmt, itemsText, makeT, matName } from "@/lib/i18n-core";
import { BOM_KEYS } from "@/lib/master";
import { canSeeCost, canSeePrice, getLang, requireUser } from "@/lib/session";
import type { OrderStatus } from "@/lib/types";

const STEP_IDX: Record<OrderStatus, number> = {
  pending_approval: 0, rejected: 0, waiting_material: 1, waiting_production: 2, in_production: 3, qc_done: 4, ready: 5, delivered: 6, completed: 7,
};
const STEPS = ["step.submitted", "step.approved", "step.materialOk", "step.producing", "step.qc", "step.fg", "step.delivered", "step.paid"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-base font-semibold text-slate-500">{label}</dt>
      <dd className="text-xl font-semibold">{children}</dd>
    </div>
  );
}

export default async function OrderDetail({ params }: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const t = makeT(await getLang());
  const db = (await loadDb());
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound();
  const role = user.role;
  if (role === "sales" && o.salesId !== user.id) notFound();

  const ops = role !== "sales";
  const price = canSeePrice(role);
  const cost = canSeeCost(role, db.settings);
  const f = financials(o, db.settings);
  const idx = STEP_IDX[o.status];
  const seller = db.users.find((u) => u.id === o.salesId)?.name ?? "";
  const issued = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(o.issues.filter((i) => i.status === "issued").reduce((s, i) => s + (i.items[k] ?? 0), 0))]));
  const actualBy = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(o.issues.reduce((s, i) => s + (i.cost?.[k] ?? 0), 0))]));
  const committed = Object.fromEntries(BOM_KEYS.map((k) => [k, r2(o.issues.filter((i) => i.status !== "rejected").reduce((s, i) => s + (i.items[k] ?? 0), 0))]));
  const remaining = Object.fromEntries(BOM_KEYS.map((k) => [k, Math.max(0, r2((o.bom?.required[k] ?? 0) - committed[k]))])) as Record<(typeof BOM_KEYS)[number], number>;
  const act = `/api/orders/${o.id}/action`;
  const extras = db.materials.filter((m) => m.custom).map((m) => ({ key: m.key, name: matName(t, m.key, db.materials), unit: m.unit, onHand: m.onHand }));
  const otherCost = r2(o.issues.reduce((s, i) => s + Object.entries(i.cost ?? {}).filter(([k]) => !BOM_KEYS.includes(k as never)).reduce((a, [, v]) => a + v, 0), 0));
  const hasIssued = o.issues.some((i) => i.status === "issued");
  const openIssue = o.issues.find((i) => i.status === "requested");
  const orderLines = [`${o.id} · ${o.customer}`, `Ø${o.diameter} · ${t(`spec.${o.spec}`)} · ${fmt(o.totalLength)} m`, ...(price ? [`${t("f.price")}: ${fmt(o.price)} ${t("baht")}`] : [])];

  return (
    <>
      <PageHeader title={o.id} sub={o.customer} right={<StatusBadge status={o.status} t={t} />} />

      {/* Progress */}
      <div className="card mb-6 overflow-x-auto">
        <ol className="flex min-w-[56rem] items-start">
          {STEPS.map((s, i) => {
            const done = i <= idx && o.status !== "rejected";
            const current = i === idx;
            const bad = o.status === "rejected" && i === 0;
            return (
              <li key={s} className="flex flex-1 flex-col items-center text-center">
                <div className={`flex size-11 items-center justify-center rounded-full text-lg font-bold ${bad ? "bg-red-600 text-white" : done ? (current ? "bg-blue-700 text-white ring-4 ring-blue-200" : "bg-emerald-600 text-white") : "bg-slate-200 text-slate-500"}`}>
                  {bad ? "✕" : done && !current ? "✓" : i + 1}
                </div>
                <div className={`mt-2 px-1 text-base ${current ? "font-bold" : "text-slate-600"}`}>{t(s)}</div>
              </li>
            );
          })}
        </ol>
      </div>

      {o.status === "rejected" && (
        <div className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
          <div className="text-xl font-bold text-red-800">{t("o.rejectReason")}</div>
          <p className="mt-1 text-xl">{o.rejectReason}</p>
          {role === "sales" && o.salesId === user.id && (
            <Link href={`/orders/${o.id}/edit`} className="btn btn-primary mt-4">{t("form.edit")}</Link>
          )}
        </div>
      )}

      {o.status === "waiting_material" && o.shortage && (
        <div className="mb-6 rounded-2xl border-2 border-orange-300 bg-orange-50 p-5">
          <div className="text-xl font-bold text-orange-900">{t("o.waitMaterial")}</div>
          {ops ? (
            <p className="mt-1 text-xl">
              {BOM_KEYS.filter((k) => o.shortage![k] > 0).map((k) => `${t(`mat.${k}`)} ${fmt(o.shortage![k])} kg`).join(" · ")}
            </p>
          ) : (
            <p className="mt-1 text-xl">{t("o.waitMaterialSales")}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {(() => {
        const blocks: React.ReactNode[] = [];
        if (role === "approver" && o.status === "pending_approval")
          blocks.push(
            <div key="ap" className="card grid gap-6 border-2 border-blue-300 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-2xl font-bold">{t("act.reviewTitle")}</h3>
                <p className="mb-4 text-lg text-slate-600">{t("act.reviewHint")}</p>
                <ActionButton url={act} body={{ action: "approve" }} label={t("act.approve")} variant="green" confirm={{ title: t("confirm.approveOrder"), lines: orderLines }} />
              </div>
              <RejectForm orderId={o.id} />
            </div>,
          );
        if (role === "sales" && o.salesId === user.id && o.status === "ready")
          blocks.push(<div key="dl" className="card border-2 border-blue-300"><ActionButton url={act} body={{ action: "deliver" }} label={t("act.deliver")} variant="green" confirm={{ title: t("confirm.deliver"), lines: orderLines }} /></div>);
        if (role === "sales" && o.salesId === user.id && o.status === "delivered")
          blocks.push(<div key="pay" className="card border-2 border-blue-300"><ActionButton url={act} body={{ action: "pay" }} label={t("act.pay")} variant="green" confirm={{ title: t("confirm.pay"), lines: orderLines }} /></div>);
        if (role === "production" && ["waiting_production", "in_production"].includes(o.status))
          blocks.push(
            <div key="pr" className="card flex flex-col gap-6 border-2 border-blue-300">
              <div>
                <h3 className="mb-3 text-2xl font-bold">{t("act.requestIssue")}</h3>
                <IssueRequestForm key={`${openIssue?.id}-${openIssue?.edits?.length ?? 0}-${openIssue?.approval}`} orderId={o.id} remaining={remaining} extras={extras} open={openIssue && { id: openIssue.id, items: openIssue.items, approval: openIssue.approval }} />
              </div>
              <div className="flex flex-wrap gap-4 border-t border-slate-200 pt-5">
                {o.status === "waiting_production" && (
                  <div>
                    <ActionButton url={act} body={{ action: "start" }} label={t("act.start")} disabled={!hasIssued} confirm={{ title: t("confirm.start"), lines: orderLines }} />
                    {!hasIssued && <p className="mt-2 text-base text-slate-500">{t("act.startHint")}</p>}
                  </div>
                )}
                {o.status === "in_production" && (
                  <ActionButton url={act} body={{ action: "finish" }} label={t("act.finish")} variant="green" confirm={{ title: t("confirm.finish"), lines: orderLines }} />
                )}
              </div>
            </div>,
          );
        if (role === "store" && o.status === "qc_done")
          blocks.push(
            <div key="st" className="card border-2 border-blue-300">
              <h3 className="mb-3 text-2xl font-bold">{t("act.fgTitle")}</h3>
              <FgForm orderId={o.id} pieces={o.pieceCount} />
            </div>,
          );
        return blocks.length ? <div className="mb-6 flex flex-col gap-6">{blocks}</div> : null;
      })()}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order info */}
        <section className="card lg:col-span-2">
          <h2 className="mb-2 text-2xl font-bold">{t("o.info")}</h2>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <Row label={t("f.customer")}>{o.customer}</Row>
            <Row label={t("f.poRef")}>{o.poRef || "—"}</Row>
            <Row label={t("o.sales")}>{seller}</Row>
            <Row label={t("f.type")}>{t("type.pipe")}</Row>
            <Row label={t("f.size")}>Ø{o.diameter}</Row>
            <Row label={t("f.spec")}>{t(`spec.${o.spec}`)}</Row>
            <Row label={t("f.cutting")}>{fmt(o.pieceLength)} m × {fmt(o.pieceCount, 0)} {t("pieces")}</Row>
            <Row label={t("f.totalLength")}>{fmt(o.totalLength)} m</Row>
            {price && <Row label={t("f.price")}>{fmt(o.price)} {t("baht")}</Row>}
            <Row label={t("f.deliveryDate")}>{fdate(o.deliveryDate)}</Row>
            <Row label={t("f.paymentDate")}>{fdate(o.paymentDate)}</Row>
            {price && (
              <div className="md:col-span-2">
                <Row label={t("f.expenses")}>
                  {o.expenses.length === 0 ? "—" : (
                    <ul className="text-lg font-normal">
                      {o.expenses.map((x, i) => <li key={i}>{x.name}: <b>{fmt(x.amount)}</b> {t("baht")}</li>)}
                    </ul>
                  )}
                </Row>
              </div>
            )}
            <Row label={t("o.attachments")}>
              <ul className="text-lg font-normal">{o.attachments.map((a) => <li key={a.name}>📎 {a.name}</li>)}</ul>
            </Row>
          </dl>
        </section>

        {/* Money */}
        <section className="flex flex-col gap-6">
          {role === "sales" && f.counted && (
            <div className={`card border-2 ${f.earned ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"}`}>
              <div className="text-lg font-semibold text-slate-600">{t("fin.commission")}</div>
              <div className="text-4xl font-bold">{fmt(f.commission)} <span className="text-xl">{t("baht")}</span></div>
              <div className="mt-1 text-xl font-bold">{f.earned ? t("comm.earned") : t("comm.pending")}</div>
              <div className="mt-1 text-base text-slate-500">{t("comm.when", { when: t(`set.trig.${db.settings.commissionTrigger}`) })}</div>
            </div>
          )}
          {cost && f.counted && (
            <div className="card">
              <h2 className="mb-2 text-2xl font-bold">{t("fin.title")}</h2>
              <table className="w-full text-xl">
                <tbody>
                  {([
                    ["fin.sales", f.sales],
                    [f.isEstimate ? "fin.costEst" : "fin.cost", -f.cost],
                    ["fin.gross", f.gross],
                    ["fin.deduct", -f.expenses],
                    ["fin.net", f.net],
                  ] as [string, number][]).map(([k, v]) => (
                    <tr key={k} className={k === "fin.net" || k === "fin.gross" ? "font-bold" : ""}>
                      <td className="py-1.5">{t(k)}</td>
                      <td className={`py-1.5 text-right ${v < 0 ? "text-red-700" : ""}`}>{fmt(v)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold text-blue-800">
                    <td className="pt-3">{t("fin.commission")} ({f.rate}% {db.settings.commissionBase === "sales" ? t("set.baseSales") : t("set.baseNet")})</td>
                    <td className="pt-3 text-right">{fmt(f.commission)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-base text-slate-500">{f.isEstimate ? t("fin.estNote") : t("fin.actualNote")}</p>
            </div>
          )}
        </section>
      </div>

      {/* BOM */}
      {ops && o.bom && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="mb-1 text-2xl font-bold">{t("bom.title")}</h2>
          <p className="mb-3 text-base text-slate-500">{t("bom.sub", { total: fmt(o.bom.perMeter.total) })}</p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t("rc.material")}</th>
                <th className="th text-right">kg / m</th>
                <th className="th text-right">{t("bom.required")} (kg)</th>
                <th className="th text-right">{t("bom.issued")} (kg)</th>
                <th className="th text-right">{t("bom.reservedLeft")} (kg)</th>
                {o.status === "waiting_material" && <th className="th text-right">{t("bom.short")} (kg)</th>}
                {cost && <th className="th text-right">{t("bom.estCost")}</th>}
                {cost && <th className="th text-right">{t("bom.actualCost")}</th>}
              </tr>
            </thead>
            <tbody>
              {BOM_KEYS.map((k) => (
                <tr key={k}>
                  <td className="td font-semibold">{t(`mat.${k}`)}</td>
                  <td className="td text-right">{fmt(o.bom!.perMeter[k])}</td>
                  <td className="td text-right">{fmt(o.bom!.required[k])}</td>
                  <td className="td text-right">{fmt(issued[k])}</td>
                  <td className="td text-right">{fmt(o.reservedRemaining?.[k] ?? 0)}</td>
                  {o.status === "waiting_material" && (
                    <td className={`td text-right font-bold ${(o.shortage?.[k] ?? 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(o.shortage?.[k] ?? 0)}</td>
                  )}
                  {cost && <td className="td text-right">{fmt(o.bom!.estCost[k])}</td>}
                  {cost && <td className="td text-right">{fmt(actualBy[k])}</td>}
                </tr>
              ))}
              {cost && otherCost > 0 && (
                <tr>
                  <td className="td font-semibold">{t("bom.other")}</td>
                  <td className="td" colSpan={o.status === "waiting_material" ? 5 : 4} />
                  <td className="td" />
                  <td className="td text-right">{fmt(otherCost)}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="td">{t("total")}</td>
                <td className="td text-right">{fmt(o.bom.perMeter.total)}</td>
                <td className="td text-right">{fmt(o.bom.requiredTotal)}</td>
                <td className="td text-right">{fmt(r2(BOM_KEYS.reduce((s, k) => s + issued[k], 0)))}</td>
                <td className="td text-right">{fmt(r2(BOM_KEYS.reduce((s, k) => s + (o.reservedRemaining?.[k] ?? 0), 0)))}</td>
                {o.status === "waiting_material" && <td className="td" />}
                {cost && <td className="td text-right">{fmt(o.bom.estCostTotal)}</td>}
                {cost && <td className="td text-right">{fmt(r2(BOM_KEYS.reduce((s, k) => s + actualBy[k], 0) + otherCost))}</td>}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Material issues */}
      {ops && o.issues.length > 0 && (
        <section className="card mt-6">
          <h2 className="mb-3 text-2xl font-bold">{t("issue.title")}</h2>
          <div className="flex flex-col gap-4">
            {o.issues.map((i) => (
              <div key={i.id} className="rounded-xl border-2 border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <b className="text-xl">{i.id}</b>
                  <span className="text-base text-slate-500">{fdt(i.requestedAt)} · {i.requestedBy}</span>
                  <span className={`rounded-full border-2 px-3 py-0.5 text-base font-bold ${i.status === "issued" ? "border-emerald-300 bg-emerald-100 text-emerald-900" : i.status === "rejected" ? "border-red-300 bg-red-100 text-red-900" : i.status === "cancelled" ? "border-slate-300 bg-slate-100 text-slate-600" : "border-sky-300 bg-sky-100 text-sky-900"}`}>
                    {t(`issue.st.${i.status}`)}
                  </span>
                  {i.overBom && (
                    <span className="rounded-full border-2 border-orange-300 bg-orange-100 px-3 py-0.5 text-base font-bold text-orange-900">
                      {t("issue.over")} · {t(`issue.ap.${i.approval}`)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-lg">{itemsText(t, i.items, db.materials)}</p>
                {(i.edits?.length ?? 0) > 0 && (
                  <details className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-base">
                    <summary className="cursor-pointer font-semibold">{t("issue.editLog")} ({i.edits!.length})</summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {i.edits!.map((e, n) => (
                        <li key={n}>
                          <span className="text-slate-500">{fdt(e.at)} · {e.by}</span>
                          <div>
                            {[...new Set([...Object.keys(e.from), ...Object.keys(e.to)])]
                              .filter((k) => (e.from[k] ?? 0) !== (e.to[k] ?? 0))
                              .map((k) => `${matName(t, k, db.materials)} ${fmt(e.from[k] ?? 0)} → ${fmt(e.to[k] ?? 0)}`)
                              .join(" · ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-3 flex flex-wrap gap-4">
                  {role === "approver" && i.approval === "pending" && (
                    <>
                      <ActionButton url={act} body={{ action: "approve_issue", issueId: i.id }} label={t("act.approve")} variant="green" confirm={{ title: t("confirm.approveIssue"), lines: [`${o.id} · ${i.id}`, itemsText(t, i.items, db.materials)] }} />
                      <ActionButton url={act} body={{ action: "reject_issue", issueId: i.id }} label={t("act.reject")} variant="red" confirm={{ title: t("confirm.rejectIssue"), lines: [`${o.id} · ${i.id}`, itemsText(t, i.items, db.materials)], warning: t("confirm.irreversible"), danger: true }} />
                    </>
                  )}
                  {role === "store" && i.status === "requested" && i.approval !== "pending" && (
                    <ActionButton url={act} body={{ action: "issue", issueId: i.id }} label={t("act.issue")} variant="green" confirm={{ title: t("confirm.issue"), lines: [`${o.id} · ${i.id}`, itemsText(t, i.items, db.materials)], warning: t("confirm.irreversible"), danger: true }} />
                  )}
                  {role === "store" && i.status === "requested" && i.approval === "pending" && (
                    <span className="text-lg text-orange-700">{t("issue.waitApproval")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Finished goods */}
      {ops && o.fg && (
        <section className="card mt-6">
          <h2 className="mb-2 text-2xl font-bold">{t("fg.title")}</h2>
          <p className="text-xl">
            {fdt(o.fg.receivedAt)}<br />
            Ø{o.diameter} · {t(`spec.${o.spec}`)} · {fmt(o.pieceLength)} m × {fmt(o.fg.pieces, 0)} {t("pieces")}
            {price && <><br />{t("fg.value")}: {fmt(o.fg.saleValue)} {t("baht")}</>}
          </p>
        </section>
      )}

      {/* History */}
      <section className="card mt-6">
        <h2 className="mb-3 text-2xl font-bold">{t("o.history")}</h2>
        <ol className="flex flex-col gap-2 border-l-4 border-slate-200 pl-5">
          {[...o.history].reverse().map((h, i) => (
            <li key={i} className="text-lg">
              <span className="text-base text-slate-500">{fdt(h.at)} · {h.by}</span>
              <div className="font-semibold">{t(h.action)}{h.note ? ` — ${h.note}` : ""}</div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
