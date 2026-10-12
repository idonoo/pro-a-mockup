"use client";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";

export function LoginCard({ userId, name, role, home }: { userId: string; name: string; role: string; home: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <button
      className="card flex cursor-pointer flex-col items-start justify-start text-left transition hover:border-blue-500 hover:shadow-md"
      onClick={async () => {
        await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
        router.push(home);
        router.refresh();
      }}
    >
      <div className="text-2xl font-bold">{name}</div>
      <div className="mt-1 text-xl text-blue-800">{t(`role.${role}`)}</div>
      <div className="mt-2 text-base text-slate-500">{t(`roleDesc.${role}`)}</div>
    </button>
  );
}
