"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18nProvider";

export type ConfirmSpec = {
  title: string;
  lines?: string[]; // summary of what is about to happen (PO, material, qty, price …)
  warning?: string; // shown in red for actions that cannot be undone
  danger?: boolean; // red confirm button
};

/** Opens a confirm dialog first. Cancel leaves everything untouched; Confirm runs `run` and stays locked while it saves. */
export function ConfirmButton({
  label,
  variant = "primary",
  spec,
  run,
  disabled,
  className = "",
}: {
  label: string;
  variant?: "primary" | "green" | "red" | "ghost";
  spec: ConfirmSpec;
  run: () => Promise<string[] | null>; // null = success, otherwise error keys
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    const errs = await run();
    setBusy(false);
    if (errs && errs.length) setErrors(errs);
    else setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`btn btn-${variant} ${className}`}
        disabled={disabled}
        onClick={() => {
          setErrors([]);
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={spec.title}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className={`text-2xl font-bold ${spec.danger ? "text-red-700" : ""}`}>{spec.title}</h2>
            {spec.lines && spec.lines.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 rounded-xl bg-slate-100 px-4 py-3 text-lg">
                {spec.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {spec.warning && <p className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-lg font-semibold text-red-800">⚠ {spec.warning}</p>}
            {errors.length > 0 && (
              <ul className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-lg text-red-800">
                {errors.map((e) => (
                  <li key={e}>• {t(e)}</li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
                {t("cancel")}
              </button>
              <button type="button" className={`btn ${spec.danger ? "btn-red" : "btn-primary"}`} disabled={busy} onClick={confirm} autoFocus>
                {busy ? "…" : t("confirm.ok")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
