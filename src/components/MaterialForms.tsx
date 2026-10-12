"use client";
import { useState } from "react";
import { useRun } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

const EMPTY = { nameTh: "", nameEn: "", category: "other", unit: "kg", altUnit: "", factor: "", price: "" };

/** Purchasing / executive: create a new item that can be received into stock. */
export function AddMaterialForm({ showPrice = true }: { showPrice?: boolean }) {
  const t = useT();
  const run = useRun();
  const [v, setV] = useState(EMPTY);
  const catLabel = t(`mm.cat.${v.category}`);
  return (
    <div className="grid gap-5 md:grid-cols-4">
      <div>
        <label className="label">{t("mm.nameTh")}</label>
        <input className="input" value={v.nameTh} onChange={(e) => setV({ ...v, nameTh: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("mm.nameEn")}</label>
        <input className="input" value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("mm.category")}</label>
        <select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
          <option value="bom">{t("mm.cat.bom")}</option>
          <option value="other">{t("mm.cat.other")}</option>
          <option value="spare">{t("mm.cat.spare")}</option>
        </select>
      </div>
      <div>
        <label className="label">{t("mm.unit")}</label>
        <input className="input" value={v.unit} placeholder="kg / m / pcs" onChange={(e) => setV({ ...v, unit: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("mm.altUnit")}</label>
        <input className="input" value={v.altUnit} placeholder={t("mm.altUnitHint")} onChange={(e) => setV({ ...v, altUnit: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("mm.factor", { alt: v.altUnit || "…", unit: v.unit || "…" })}</label>
        <input className="input" type="number" min={0} step="any" value={v.factor} disabled={!v.altUnit} onChange={(e) => setV({ ...v, factor: e.target.value })} />
      </div>
      {showPrice && (
        <div>
          <label className="label">{t("mm.price")}</label>
          <input className="input" type="number" min={0} step="any" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
        </div>
      )}
      {v.category === "bom" && <p className="note-tbc md:col-span-4">{t("mm.bomNote")}</p>}
      <div className="md:col-span-4">
        <ConfirmButton
          label={`+ ${t("mm.add")}`}
          spec={{
            title: t("confirm.addMaterial"),
            lines: [
              `${v.nameTh || "—"} / ${v.nameEn || "—"}`,
              `${t("mm.category")}: ${catLabel}`,
              `${t("mm.unit")}: ${v.unit}${v.altUnit ? ` · 1 ${v.altUnit} = ${v.factor || "?"} ${v.unit}` : ""}`,
              ...(showPrice ? [`${t("mm.price")}: ${v.price || 0}`] : []),
            ],
          }}
          run={run("/api/materials", { ...v, price: Number(v.price) || 0, factor: Number(v.factor) || 0 }, { after: () => setV(EMPTY) })}
        />
      </div>
    </div>
  );
}
