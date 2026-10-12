"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, type TFn } from "@/lib/i18n-core";
import type { Lang } from "@/lib/types";

const Ctx = createContext<{ lang: Lang; t: TFn }>({ lang: "th", t: makeT("th") });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const v = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
