"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIZES, TIS_MAX } from "@/lib/master";
import type { OrderInput, Spec } from "@/lib/types";
import { fmt } from "@/lib/i18n-core";
import { post } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: OrderInput = {
  customer: "",
  poRef: "",
  diameter: 300,
  spec: "tis",
  totalLength: 0,
  pieceLength: 0,
  pieceCount: 0,
  price: 0,
  expenses: [],
  deliveryDate: "",
  paymentDate: "",
  attachments: [],
};

export function OrderForm({ initial, orderId }: { initial?: OrderInput; orderId?: string }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState<OrderInput>(initial ?? EMPTY);
  const [touchedTotal, setTouchedTotal] = useState(!!initial);

  const set = <K extends keyof OrderInput>(k: K, v: OrderInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const setPieces = (k: "pieceLength" | "pieceCount", v: number) =>
    setF((p) => {
      const n = { ...p, [k]: v };
      return touchedTotal ? n : { ...n, totalLength: Math.round(n.pieceLength * n.pieceCount * 100) / 100 };
    });
  const setSize = (d: number) => setF((p) => ({ ...p, diameter: d, spec: d > TIS_MAX && p.spec === "tis" ? "innovation" : p.spec }));
  const tisOk = f.diameter <= TIS_MAX;
  const num = (s: string) => (s === "" ? 0 : Number(s));

  const submit = async (): Promise<string[] | null> => {
    const r = orderId ? await post(`/api/orders/${orderId}`, f, "PUT") : await post("/api/orders", f);
    if (!r.ok) return r.errors ?? ["err.generic"];
    router.push(`/orders/${r.id ?? orderId}`);
    return null;
  };
  // Expense rows: a draft row is filled in, then confirmed (button or Enter) into the list
  const [draft, setDraft] = useState<{ index: number | null; name: string; amount: string } | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [flash, setFlash] = useState<{ index: number; kind: "added" | "saved" } | null>(null);
  const openDraft = (index: number | null = null) => {
    const x = index === null ? null : f.expenses[index];
    setDraft({ index, name: x?.name ?? "", amount: x ? String(x.amount) : "" });
    setDraftError(false);
  };
  const confirmDraft = () => {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!draft.name.trim() || draft.amount === "" || Number.isNaN(amount) || amount < 0) return setDraftError(true);
    const row = { name: draft.name.trim(), amount };
    const index = draft.index ?? f.expenses.length;
    set("expenses", draft.index === null ? [...f.expenses, row] : f.expenses.map((x, j) => (j === draft.index ? row : x)));
    setDraft(null);
    setFlash({ index, kind: draft.index === null ? "added" : "saved" });
    setTimeout(() => setFlash((c) => (c?.index === index ? null : c)), 3000);
  };
  const expensesTotal = f.expenses.reduce((a, x) => a + (x.amount || 0), 0);

  const numField = (k: "totalLength" | "pieceLength" | "pieceCount" | "price", label: string, step = "any") => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        value={f[k] || ""}
        onChange={(e) => {
          const v = num(e.target.value);
          if (k === "pieceLength" || k === "pieceCount") setPieces(k, v);
          else {
            if (k === "totalLength") setTouchedTotal(true);
            set(k, v);
          }
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="card grid gap-5 md:grid-cols-2">
        <h2 className="text-2xl font-bold md:col-span-2">{t("form.s1")}</h2>
        <div>
          <label className="label">{t("f.customer")}</label>
          <input className="input" value={f.customer} onChange={(e) => set("customer", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("f.poRef")}</label>
          <input className="input" value={f.poRef} onChange={(e) => set("poRef", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("f.type")}</label>
          <input className="input" value={t("type.pipe")} disabled />
        </div>
        <div>
          <label className="label">{t("f.size")}</label>
          <select className="input" value={f.diameter} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((d) => (
              <option key={d} value={d}>
                Ø{d}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">{t("f.spec")}</label>
          <div className="grid gap-3 md:grid-cols-2">
            {(["tis", "innovation"] as Spec[]).map((s) => {
              const disabled = s === "tis" && !tisOk;
              return (
                <label
                  key={s}
                  className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-lg font-semibold ${f.spec === s ? "border-blue-600 bg-blue-50" : "border-slate-300"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <input type="radio" className="size-6" name="spec" disabled={disabled} checked={f.spec === s} onChange={() => set("spec", s)} />
                  {t(`spec.${s}`)}
                </label>
              );
            })}
          </div>
          {!tisOk && <p className="mt-2 text-base text-orange-700">{t("form.tisHint")}</p>}
        </div>
      </section>

      <section className="card grid gap-5 md:grid-cols-3">
        <h2 className="text-2xl font-bold md:col-span-3">{t("form.s2")}</h2>
        {numField("pieceLength", t("f.pieceLength"))}
        {numField("pieceCount", t("f.pieceCount"), "1")}
        {numField("totalLength", t("f.totalLength"))}
        <p className="text-base text-slate-500 md:col-span-3">{t("form.totalHint")}</p>
      </section>

      <section className="card grid gap-5 md:grid-cols-3">
        <h2 className="text-2xl font-bold md:col-span-3">{t("form.s3")}</h2>
        {numField("price", t("f.price"))}
        <div>
          <label className="label">{t("f.deliveryDate")}</label>
          <input className="input" type="date" min={today()} value={f.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("f.paymentDate")}</label>
          <input className="input" type="date" min={today()} value={f.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
        </div>

        <div className="md:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">{t("f.expenses")}</h3>
              <p className="text-base text-slate-500">{t("f.expensesHint")}</p>
            </div>
            <button type="button" className="btn btn-ghost" disabled={!!draft} onClick={() => openDraft()}>
              + {t("f.addExpense")}
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {f.expenses.map((x, i) =>
              draft?.index === i ? null : (
                <li
                  key={i}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border-2 px-4 py-2 text-lg transition-colors ${flash?.index === i ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white" aria-hidden>✓</span>
                  <span className="min-w-0 flex-1 font-semibold">{x.name}</span>
                  {flash?.index === i && <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-base font-bold text-white">{flash.kind === "added" ? t("f.expenseAdded") : t("f.expenseSaved")}</span>}
                  <span className="w-40 text-right font-bold">{fmt(x.amount)} {t("baht")}</span>
                  <button type="button" className="btn btn-ghost !min-h-10 !px-3 !text-base" disabled={!!draft} onClick={() => openDraft(i)}>✎ {t("f.editExpense")}</button>
                  <button type="button" className="btn btn-ghost !min-h-10 !px-3 !text-base" disabled={!!draft} aria-label={t("f.removeExpense")} onClick={() => set("expenses", f.expenses.filter((_, j) => j !== i))}>✕ {t("f.removeExpense")}</button>
                </li>
              ),
            )}
            {f.expenses.length === 0 && !draft && <li className="text-lg text-slate-400">{t("f.expensesEmpty")}</li>}
          </ul>

          {draft && (
            <div className="mt-3 rounded-xl border-2 border-blue-400 bg-blue-50 p-4" onKeyDown={(e) => e.key === "Escape" && setDraft(null)}>
              <div className="grid items-end gap-3 md:grid-cols-[1fr_14rem_auto_auto]">
                <div>
                  <label className="label">{t("f.expenseName")}</label>
                  <input
                    className="input"
                    autoFocus
                    value={draft.name}
                    placeholder={t("f.expensePlaceholder")}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmDraft())}
                  />
                </div>
                <div>
                  <label className="label">{t("f.expenseAmount")}</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="any"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmDraft())}
                  />
                </div>
                <button type="button" className="btn btn-green" onClick={confirmDraft}>✓ {t("f.confirmExpense")}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>{t("cancel")}</button>
              </div>
              <p className={`mt-2 text-base ${draftError ? "font-semibold text-red-700" : "text-slate-500"}`}>{draftError ? t("f.draftInvalid") : t("f.enterHint")}</p>
            </div>
          )}

          {f.expenses.length > 0 && (
            <div className="mt-3 flex justify-between rounded-xl bg-slate-100 px-4 py-2 text-lg font-bold">
              <span>{t("f.expensesTotal")} ({f.expenses.length})</span>
              <span>{fmt(expensesTotal)} {t("baht")}</span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 text-2xl font-bold">{t("form.s4")}</h2>
        <p className="mb-3 text-base text-slate-500">{t("form.attachHint")}</p>
        <input
          type="file"
          multiple
          className="input py-3"
          onChange={(e) =>
            set("attachments", [...(e.target.files ?? [])].map((x) => ({ name: x.name, size: x.size })))
          }
        />
        {f.attachments.length > 0 && (
          <ul className="mt-3 list-disc pl-6 text-lg">
            {f.attachments.map((a) => (
              <li key={a.name}>{a.name}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-4">
        <ConfirmButton
          label={orderId ? t("form.resubmit") : t("form.submit")}
          className="!min-h-16 !px-10 !text-xl"
          disabled={!!draft}
          spec={{
            title: orderId ? t("confirm.resubmitOrder") : t("confirm.submitOrder"),
            lines: [
              `${orderId ? orderId + " · " : ""}${f.customer || "—"}`,
              `Ø${f.diameter} · ${t(`spec.${f.spec}`)} · ${fmt(f.pieceLength)} m × ${fmt(f.pieceCount, 0)} = ${fmt(f.totalLength)} m`,
              `${t("f.price")}: ${fmt(f.price)} · ${t("f.expenses")}: ${fmt(expensesTotal)}`,
              `${t("form.s4")}: ${f.attachments.length}`,
            ],
          }}
          run={submit}
        />
        <button className="btn btn-ghost min-h-16 text-xl" onClick={() => router.back()}>
          {t("cancel")}
        </button>
        {draft && <p className="self-center text-lg font-semibold text-amber-700">{t("f.draftOpen")}</p>}
      </div>
    </div>
  );
}
