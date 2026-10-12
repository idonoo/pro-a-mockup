"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18nProvider";

/** Left menu + header. The ☰ button collapses the menu so the content uses the full width; the choice is remembered. */
export function AppShell({ sidebar, headerLeft, headerRight, children }: { sidebar: React.ReactNode; headerLeft: React.ReactNode; headerRight: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("menuCollapsed") === "1");
    } catch {}
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("menuCollapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className={`border-b border-slate-200 bg-white p-5 lg:min-h-screen lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0 ${collapsed ? "hidden" : ""}`}>{sidebar}</aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? t("menu.show") : t("menu.hide")}
            aria-expanded={!collapsed}
            title={collapsed ? t("menu.show") : t("menu.hide")}
            className="btn btn-ghost !min-h-12 !px-4 text-2xl"
          >
            {collapsed ? "☰" : "«"}
          </button>
          <div className="mr-auto">{headerLeft}</div>
          {headerRight}
        </header>
        <main className={`p-8 ${collapsed ? "" : "mx-auto max-w-7xl"}`}>{children}</main>
      </div>
    </div>
  );
}
