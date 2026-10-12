"use client";
import { useState } from "react";
import { fdt, fmt } from "@/lib/i18n-core";
import { sizesFor } from "@/lib/master";
import type { DailyScrap, FgLine, ScrapSnapshot, Spec } from "@/lib/types";
import { useRun } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

export type ScrapOrder = { id: string; diameter: number; spec: Spec; pieceCount: number; totalLength: number; startedDate?: string; finishedDate?: string };
type Line = { diameter: string; spec: Spec; pieces: string; meters: string };

const toLine = (l: FgLine): Line => ({ diameter: String(l.diameter), spec: l.spec, pieces: String(l.pieces), meters: String(l.meters) });

/** Finished goods produced that day, grouped by size + spec, from the jobs marked "produced" on that date. */
function suggestFg(orders: ScrapOrder[], date: string): Line[] {
  const g = new Map<string, Line>();
  for (const o of orders.filter((x) => x.finishedDate === date)) {
    const k = `${o.diameter}|${o.spec}`;
    const cur = g.get(k) ?? { diameter: String(o.diameter), spec: o.spec, pieces: "0", meters: "0" };
    cur.pieces = String(Number(cur.pieces) + o.pieceCount);
    cur.meters = String(Math.round((Number(cur.meters) + o.totalLength) * 100) / 100);
    g.set(k, cur);
  }
  return [...g.values()];
}

/** Jobs that were in production on that date. */
const suggestPos = (orders: ScrapOrder[], date: string) => orders.filter((o) => o.startedDate && o.startedDate <= date && (!o.finishedDate || o.finishedDate >= date)).map((o) => o.id);

export function DailyScrapForm({ records, orders, today }: { records: DailyScrap[]; orders: ScrapOrder[]; today: string }) {
  const t = useT();
  const run = useRun();
  const [date, setDate] = useState(today);
  const [steel, setSteel] = useState("");
  const [plastic, setPlastic] = useState("");
  const [useTypeA, setUseTypeA] = useState(false);
  const [poRefs, setPoRefs] = useState<string[]>([]);
  const [poInput, setPoInput] = useState("");
  const [useTypeB, setUseTypeB] = useState(false);
  const [fg, setFg] = useState<Line[]>([]);

  const existing = records.find((r) => r.date === date);

  // switching date loads that day's record (edit) or a blank form
  const load = (d: string) => {
    setDate(d);
    const r = records.find((x) => x.date === d);
    setSteel(r ? String(r.steelKg) : "");
    setPlastic(r ? String(r.plasticKg) : "");
    setPoRefs(r ? r.poRefs : []);
    setUseTypeA(!!r && r.poRefs.length > 0);
    setFg(r ? r.fg.map(toLine) : []);
    setUseTypeB(!!r && r.fg.length > 0);
  };
  const toggleB = (on: boolean) => {
    setUseTypeB(on);
    if (on && fg.length === 0) setFg(suggestFg(orders, date));
  };
  const addPo = (id: string) => {
    const v = id.trim();
    if (v && !poRefs.includes(v)) setPoRefs([...poRefs, v]);
    setPoInput("");
  };
  const setLine = (i: number, patch: Partial<Line>) => setFg(fg.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const payload = {
    date,
    steelKg: Number(steel) || 0,
    plasticKg: Number(plastic) || 0,
    poRefs: useTypeA ? poRefs : [],
    fg: useTypeB ? fg.map((l) => ({ diameter: Number(l.diameter), spec: l.spec, pieces: Number(l.pieces), meters: Number(l.meters) })) : [],
  };
  const lines = [
    `${t("rc.date")}: ${date}`,
    `${t("scrap.steel")}: ${fmt(payload.steelKg)} · ${t("scrap.plastic")}: ${fmt(payload.plasticKg)}`,
    ...(payload.poRefs.length ? [`${t("scrap.noteA")}: ${payload.poRefs.join(", ")}`] : []),
    ...payload.fg.map((l) => `${t("scrap.noteB")}: Ø${l.diameter} ${t(`spec.${l.spec}`)} · ${fmt(l.pieces, 0)} ${t("pieces")} / ${fmt(l.meters)} m`),
    ...(existing ? [t("scrap.editNotice")] : []),
  ];

  const suggested = suggestPos(orders, date).filter((id) => !poRefs.includes(id));

  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <h2 className="mb-1 text-2xl font-bold">{existing ? t("scrap.editTitle") : t("scrap.newTitle")}</h2>
        <p className="mb-4 text-base text-slate-500">{t("scrap.sub")}</p>
        {existing && (
          <p className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-lg text-amber-900">
            {t("scrap.exists", { date, by: existing.by })}
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="label">{t("rc.date")}</label>
            <input className="input" type="date" max={today} value={date} onChange={(e) => load(e.target.value || today)} />
          </div>
          <div>
            <label className="label">{t("scrap.steel")}</label>
            <input className="input" type="number" min={0} step="any" value={steel} onChange={(e) => setSteel(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("scrap.plastic")}</label>
            <input className="input" type="number" min={0} step="any" value={plastic} onChange={(e) => setPlastic(e.target.value)} />
          </div>
        </div>

        <h3 className="mt-6 text-xl font-bold">{t("scrap.notes")}</h3>
        <p className="mb-3 text-base text-slate-500">{t("scrap.notesHint")}</p>

        <div className="mb-4 rounded-xl border-2 border-slate-200 p-4">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-semibold">
            <input type="checkbox" className="size-6" checked={useTypeA} onChange={(e) => setUseTypeA(e.target.checked)} />
            {t("scrap.noteA")}
          </label>
          {useTypeA && (
            <div className="mt-3 flex flex-col gap-3">
              {suggested.length > 0 && (
                <div>
                  <div className="mb-1 text-base text-slate-500">{t("scrap.suggest")}</div>
                  <div className="flex flex-wrap gap-2">
                    {suggested.map((id) => (
                      <button key={id} type="button" className="rounded-full border-2 border-blue-300 bg-blue-50 px-4 py-1 text-lg font-semibold text-blue-900 hover:bg-blue-100" onClick={() => addPo(id)}>
                        + {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {poRefs.map((id) => (
                  <span key={id} className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1 text-lg font-semibold text-emerald-900">
                    ✓ {id}
                    <button type="button" aria-label={t("f.removeExpense")} className="cursor-pointer text-emerald-900" onClick={() => setPoRefs(poRefs.filter((x) => x !== id))}>✕</button>
                  </span>
                ))}
                {poRefs.length === 0 && <span className="text-lg text-slate-400">—</span>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">{t("scrap.typePo")}</label>
                  <input className="input w-64" value={poInput} placeholder="PO-2026-0001" onChange={(e) => setPoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPo(poInput))} />
                </div>
                <button type="button" className="btn btn-ghost" disabled={!poInput.trim()} onClick={() => addPo(poInput)}>+ {t("f.addExpense")}</button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border-2 border-slate-200 p-4">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-semibold">
            <input type="checkbox" className="size-6" checked={useTypeB} onChange={(e) => toggleB(e.target.checked)} />
            {t("scrap.noteB")}
          </label>
          {useTypeB && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-base text-slate-500">{t("scrap.fgHint")}</p>
              {fg.map((l, i) => (
                <div key={i} className="grid items-end gap-3 md:grid-cols-[8rem_12rem_1fr_1fr_auto]">
                  <div>
                    <label className="label">{t("f.size")}</label>
                    <select className="input" value={l.diameter} onChange={(e) => setLine(i, { diameter: e.target.value })}>
                      {sizesFor(l.spec).map((d) => (
                        <option key={d} value={d}>Ø{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t("f.spec")}</label>
                    <select
                      className="input"
                      value={l.spec}
                      onChange={(e) => {
                        const spec = e.target.value as Spec;
                        setLine(i, { spec, diameter: sizesFor(spec).includes(Number(l.diameter)) ? l.diameter : String(sizesFor(spec)[0]) });
                      }}
                    >
                      <option value="tis">{t("spec.tis")}</option>
                      <option value="innovation">{t("spec.innovation")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t("scrap.pieces")}</label>
                    <input className="input" type="number" min={0} step={1} value={l.pieces} onChange={(e) => setLine(i, { pieces: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{t("scrap.meters")}</label>
                    <input className="input" type="number" min={0} step="any" value={l.meters} onChange={(e) => setLine(i, { meters: e.target.value })} />
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setFg(fg.filter((_, j) => j !== i))}>✕ {t("f.removeExpense")}</button>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setFg([...fg, { diameter: "300", spec: "tis", pieces: "", meters: "" }])}>+ {t("scrap.addLine")}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setFg(suggestFg(orders, date))}>↻ {t("scrap.pull")}</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <ConfirmButton
            label={existing ? t("scrap.saveEdit") : t("act.recordScrap")}
            disabled={payload.steelKg + payload.plasticKg <= 0}
            spec={{ title: existing ? t("confirm.scrapEdit") : t("confirm.scrap"), lines }}
            run={run("/api/scrap", payload)}
          />
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-2xl font-bold">{t("scrap.history")}</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("rc.date")}</th>
              <th className="th text-right">{t("scrap.steel")}</th>
              <th className="th text-right">{t("scrap.plastic")}</th>
              <th className="th">{t("scrap.notes")}</th>
              <th className="th">{t("scrap.recordedBy")}</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap font-semibold">{r.date}</td>
                <td className="td text-right">{fmt(r.steelKg)}</td>
                <td className="td text-right">{fmt(r.plasticKg)}</td>
                <td className="td text-base">
                  {r.poRefs.length > 0 && <div>{t("scrap.noteA")}: {r.poRefs.join(", ")}</div>}
                  {r.fg.length > 0 && <div>{t("scrap.noteB")}: {fgText(r.fg, t)}</div>}
                  {r.poRefs.length === 0 && r.fg.length === 0 && "—"}
                  {r.edits.length > 0 && (
                    <details className="mt-1 text-sm text-slate-600">
                      <summary className="cursor-pointer font-semibold">{t("issue.editLog")} ({r.edits.length})</summary>
                      <ul className="mt-1 flex flex-col gap-1">
                        {r.edits.map((e, i) => (
                          <li key={i}>{fdt(e.at)} · {e.by}: {diffText(e.from, e.to, t)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="td text-base">{r.by}<div className="text-sm text-slate-500">{fdt(r.at)}</div></td>
                <td className="td">
                  <button type="button" className="btn btn-ghost !min-h-10 !px-3 !text-base" onClick={() => { load(r.date); window.scrollTo({ top: 0, behavior: "smooth" }); }}>✎ {t("f.editExpense")}</button>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={6}>{t("empty")}</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function fgText(fg: FgLine[], t: (k: string) => string) {
  return fg.map((l) => `Ø${l.diameter} ${t(`spec.${l.spec}`)} ${fmt(l.pieces, 0)} ${t("pieces")} / ${fmt(l.meters)} m`).join(" · ");
}

function diffText(a: ScrapSnapshot, b: ScrapSnapshot, t: (k: string) => string) {
  const out: string[] = [];
  if (a.steelKg !== b.steelKg) out.push(`${t("scrap.steel")} ${a.steelKg} → ${b.steelKg}`);
  if (a.plasticKg !== b.plasticKg) out.push(`${t("scrap.plastic")} ${a.plasticKg} → ${b.plasticKg}`);
  if (a.poRefs.join(",") !== b.poRefs.join(",")) out.push(`${t("scrap.noteA")} [${a.poRefs.join(", ") || "—"}] → [${b.poRefs.join(", ") || "—"}]`);
  if (JSON.stringify(a.fg) !== JSON.stringify(b.fg)) out.push(`${t("scrap.noteB")} [${fgText(a.fg, t) || "—"}] → [${fgText(b.fg, t) || "—"}]`);
  return out.join(" · ");
}
