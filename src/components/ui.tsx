import type { OrderStatus } from "@/lib/types";
import type { TFn } from "@/lib/i18n-core";

const COLORS: Record<OrderStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-900 border-amber-300",
  rejected: "bg-red-100 text-red-900 border-red-300",
  waiting_material: "bg-orange-100 text-orange-900 border-orange-300",
  waiting_production: "bg-sky-100 text-sky-900 border-sky-300",
  in_production: "bg-blue-100 text-blue-900 border-blue-300",
  qc_done: "bg-violet-100 text-violet-900 border-violet-300",
  ready: "bg-teal-100 text-teal-900 border-teal-300",
  delivered: "bg-indigo-100 text-indigo-900 border-indigo-300",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

export function StatusBadge({ status, t }: { status: OrderStatus; t: TFn }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border-2 px-4 py-1 text-base font-bold ${COLORS[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-xl text-slate-600">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, tone = "slate", sub }: { label: string; value: React.ReactNode; tone?: string; sub?: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-200",
    green: "border-emerald-400 bg-emerald-50",
    amber: "border-amber-400 bg-amber-50",
    red: "border-red-400 bg-red-50",
    blue: "border-blue-400 bg-blue-50",
  };
  return (
    <div className={`rounded-2xl border-2 bg-white p-5 ${tones[tone]}`}>
      <div className="text-lg font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-4xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-base text-slate-500">{sub}</div>}
    </div>
  );
}

export function Tbc({ children }: { children: React.ReactNode }) {
  return (
    <div className="note-tbc">
      <b>TBC · </b>
      {children}
    </div>
  );
}
