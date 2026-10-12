"use client";
import { useRouter } from "next/navigation";
import { ConfirmButton, type ConfirmSpec } from "./ConfirmButton";
import { useT } from "./I18nProvider";

export type ApiResult = { ok: boolean; errors?: string[]; id?: string };

export async function post(url: string, body?: unknown, method = "POST"): Promise<ApiResult> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  return r.json();
}

export function Errors({ errors }: { errors: string[] }) {
  const t = useT();
  if (!errors.length) return null;
  return (
    <ul className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-lg text-red-800">
      {errors.map((e) => (
        <li key={e}>• {t(e)}</li>
      ))}
    </ul>
  );
}

/** Returns a `run` function for ConfirmButton: call the API, refresh the page on success, hand back error keys otherwise. */
export function useRun() {
  const router = useRouter();
  return (url: string, body: unknown, opts?: { method?: string; after?: (r: ApiResult) => void }) =>
    async (): Promise<string[] | null> => {
      const r = await post(url, body, opts?.method);
      if (!r.ok) return r.errors ?? ["err.generic"];
      opts?.after?.(r);
      router.refresh();
      return null;
    };
}

/** API button that always asks for confirmation first. */
export function ActionButton({
  url,
  body,
  label,
  variant = "primary",
  confirm,
  disabled,
}: {
  url: string;
  body?: unknown;
  label: string;
  variant?: "primary" | "green" | "red" | "ghost";
  confirm: ConfirmSpec;
  disabled?: boolean;
}) {
  const run = useRun();
  return <ConfirmButton label={label} variant={variant} spec={confirm} run={run(url, body)} disabled={disabled} />;
}
