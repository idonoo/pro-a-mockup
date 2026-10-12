"use client";
import { useState } from "react";
import { fmt } from "@/lib/i18n-core";
import { useRun } from "./ActionButton";
import { ConfirmButton } from "./ConfirmButton";
import { useT } from "./I18nProvider";

type Opt = { id: string; name: string };

/** Purchasing: set or change the standard price of a material for a supplier. */
export function StdPriceForm({
  materials,
  suppliers,
  presetMaterial,
  presetSupplier,
  compact,
  disabledReason,
}: {
  materials: { key: string; name: string; unit: string; hasPrice: boolean; currentSupplier?: string; currentPrice?: number }[];
  suppliers: Opt[];
  presetMaterial?: string;
  presetSupplier?: string;
  compact?: boolean;
  disabledReason?: string; // e.g. a request is already waiting for approval
}) {
  const t = useT();
  const run = useRun();
  const [material, setMaterial] = useState(presetMaterial ?? materials[0].key);
  const [supplierId, setSupplierId] = useState(presetSupplier ?? "");
  const [price, setPrice] = useState("");
  const m = materials.find((x) => x.key === material)!;
  const sup = suppliers.find((x) => x.id === supplierId);
  const isChange = m.hasPrice; // first price of a material needs no approval; anything else does
  const lines = [
    `${m.name} · ${sup?.name ?? "—"}`,
    isChange ? `${t("std.price")}: ${fmt(m.currentPrice)} → ${fmt(Number(price) || 0)} / ${m.unit}` : `${t("std.price")}: ${fmt(Number(price) || 0)} / ${m.unit}`,
    ...(isChange && m.currentSupplier && m.currentSupplier !== sup?.name ? [`${t("std.supplier")}: ${m.currentSupplier} → ${sup?.name ?? "—"}`] : []),
  ];
  if (disabledReason) return <span className="text-lg font-semibold text-amber-700">{disabledReason}</span>;
  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? "" : "gap-4"}`}>
      {!presetMaterial && (
        <div>
          <label className="label">{t("rc.material")}</label>
          <select className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>
            {materials.map((x) => (
              <option key={x.key} value={x.key}>{x.name}</option>
            ))}
          </select>
        </div>
      )}
      {!presetSupplier && (
        <div>
          <label className="label">{t("std.supplier")}</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t("rc.pickSupplier")}</option>
            {suppliers.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        {!compact && <label className="label">{t("std.priceUnit", { unit: m.unit })}</label>}
        <input className={`input ${compact ? "!min-h-11 w-36" : ""}`} type="number" min={0} step="any" placeholder={compact ? t("std.newPrice") : ""} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <ConfirmButton
        label={isChange ? t("std.requestChange") : t("std.set")}
        variant={isChange ? "ghost" : "primary"}
        className={compact ? "!min-h-11 !px-4 !text-base" : ""}
        disabled={!(Number(price) > 0) || !supplierId}
        spec={{ title: isChange ? t("confirm.priceChange") : t("confirm.priceSet"), lines, warning: isChange ? t("confirm.priceChangeWarn") : undefined }}
        run={run("/api/prices", { action: "set", material, supplierId, price: Number(price) }, { after: () => setPrice("") })}
      />
    </div>
  );
}

export function AddSupplierForm() {
  const t = useT();
  const run = useRun();
  const [name, setName] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">{t("std.newSupplier")}</label>
        <input className="input w-72" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <ConfirmButton
        label={`+ ${t("std.addSupplier")}`}
        variant="ghost"
        disabled={!name.trim()}
        spec={{ title: t("confirm.addSupplier"), lines: [name.trim()] }}
        run={run("/api/prices", { action: "add_supplier", name }, { after: () => setName("") })}
      />
    </div>
  );
}
