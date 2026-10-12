"use client";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";

export function SwitchUser() {
  const router = useRouter();
  const t = useT();
  return (
    <button
      className="btn btn-ghost min-h-12 px-4 text-base"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
    >
      {t("switchUser")}
    </button>
  );
}
