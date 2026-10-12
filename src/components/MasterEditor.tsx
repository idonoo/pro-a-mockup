"use client";
import { useState } from "react";
import { perMeter } from "@/lib/calc";
import { fdt, fmt } from "@/lib/i18n-core";
import { sizesFor } from "@/lib/master";
import type { MasterLog, MasterRow, Spec } from "@/lib/types";
import { useRun } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

type Tables = Record<Spec, Record<number, MasterRow>>;

/** Executive: edit steel and PE kg/m per spec table. Adhesive, moisture barrier, masterbatch and the total are derived live. */
export function MasterEditor({ master, log }: { master: Tables; log: MasterLog[] }) {
  const t = useT();
  const run = useRun();
  const [spec, setSpec] = useState<Spec>("tis");
  const [draft, setDraft] = useState<Record<Spec, Record<number, { steel: string; pe: string }>>>(() => {
    const d = {} as Record<Spec, Record<number, { steel: string; pe: string }>>;
    for (const s of ["tis", "innovation"] as Spec[]) d[s] = Object.fromEntries(Object.entries(master[s]).map(([k, v]) => [k, { steel: String(v.steel), pe: String(v.pe) }]));
    return d;
  });

  const sizes = sizesFor(spec);
  const rows = sizes.map((d) => ({ d, saved: master[spec][d], draft: draft[spec][d] }));
  const changed = rows.filter((r) => Number(r.draft.steel) !== r.saved.steel || Number(r.draft.pe) !== r.saved.pe);
  const invalid = rows.some((r) => !(Number(r.draft.steel) > 0) || !(Number(r.draft.pe) > 0));
  const set = (d: number, f: "steel" | "pe", v: string) => setDraft({ ...draft, [spec]: { ...draft[spec], [d]: { ...draft[spec][d], [f]: v } } });

  const lines = changed.flatMap((r) => [
    ...(Number(r.draft.steel) !== r.saved.steel ? [`Ø${r.d} · ${t("mat.steel")}: ${r.saved.steel} → ${r.draft.steel}`] : []),
    ...(Number(r.draft.pe) !== r.saved.pe ? [`Ø${r.d} · ${t("mat.pe")}: ${r.saved.pe} → ${r.draft.pe}`] : []),
  ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(["tis", "innovation"] as Spec[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={spec === s}
            onClick={() => setSpec(s)}
            className={`min-h-12 cursor-pointer rounded-xl border-2 px-5 text-lg font-bold ${spec === s ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`}
          >
            {t(`spec.${s}`)} ({sizesFor(s).length} {t("master.sizes")})
          </button>
        ))}
      </div>
      {spec === "tis" && <p className="mb-3 text-base text-slate-500">{t("master.tisNote")}</p>}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t("f.size")}</th>
              <th className="th text-right">{t("mat.steel")} ✎</th>
              <th className="th text-right">{t("mat.glue")}</th>
              <th className="th text-right">{t("mat.pe")} ✎</th>
              <th className="th text-right">{t("mat.moisture")}</th>
              <th className="th text-right">{t("mat.masterbatch")}</th>
              <th className="th text-right">{t("total")} kg/m</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, saved, draft: dr }) => {
              const steel = Number(dr.steel) > 0 ? Number(dr.steel) : saved.steel;
              const pe = Number(dr.pe) > 0 ? Number(dr.pe) : saved.pe;
              const pm = perMeter({ steel, pe });
              const dirty = steel !== saved.steel || pe !== saved.pe;
              return (
                <tr key={d} className={dirty ? "bg-amber-50" : ""}>
                  <td className="td font-bold">Ø{d}</td>
                  <td className="td text-right">
                    <input className="input !min-h-10 w-28 text-right" type="number" min={0} step="any" value={dr.steel} onChange={(e) => set(d, "steel", e.target.value)} />
                  </td>
                  <td className="td text-right text-slate-600">{fmt(pm.glue)}</td>
                  <td className="td text-right">
                    <input className="input !min-h-10 w-28 text-right" type="number" min={0} step="any" value={dr.pe} onChange={(e) => set(d, "pe", e.target.value)} />
                  </td>
                  <td className="td text-right text-slate-600">{fmt(pm.moisture)}</td>
                  <td className="td text-right text-slate-600">{fmt(pm.masterbatch)}</td>
                  <td className="td text-right font-bold">{fmt(pm.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <ConfirmButton
          label={`${t("save")} (${t(`spec.${spec}`)})`}
          disabled={changed.length === 0 || invalid}
          spec={{ title: t("confirm.master", { spec: t(`spec.${spec}`) }), lines }}
          run={run("/api/master", { spec, rows: changed.map((r) => ({ diameter: r.d, steel: Number(r.draft.steel), pe: Number(r.draft.pe) })) })}
        />
        <p className="mt-2 text-base text-slate-500">{t("master.saveHint")}</p>
      </div>

      <h3 className="mt-8 mb-2 text-xl font-bold">{t("master.log")}</h3>
      {log.length === 0 ? (
        <p className="text-lg text-slate-500">—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t("rc.date")}</th>
                <th className="th">{t("log.by")}</th>
                <th className="th">{t("f.spec")}</th>
                <th className="th">{t("f.size")}</th>
                <th className="th">{t("rc.material")}</th>
                <th className="th text-right">{t("log.change")}</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 20).map((l, i) => (
                <tr key={i}>
                  <td className="td whitespace-nowrap">{fdt(l.at)}</td>
                  <td className="td">{l.by}</td>
                  <td className="td">{t(`spec.${l.spec}`)}</td>
                  <td className="td">Ø{l.diameter}</td>
                  <td className="td">{t(`mat.${l.field}`)}</td>
                  <td className="td text-right">{l.from} → {l.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
