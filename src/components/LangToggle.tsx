"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";

export function LangToggle() {
  const { lang } = useI18n();
  const router = useRouter();
  const set = (l: string) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000`;
    router.refresh();
  };
  return (
    <div className="inline-flex overflow-hidden rounded-xl border-2 border-slate-300 bg-white" role="group" aria-label="language">
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          className={`min-h-12 min-w-16 cursor-pointer px-4 text-lg font-bold ${lang === l ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
        >
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
