"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18nProvider";

export function NavLinks({ items }: { items: { href: string; key: string }[] }) {
  const path = usePathname();
  const t = useT();
  const best = items.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="flex flex-col gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-xl px-5 py-4 text-xl font-semibold ${best?.href === i.href ? "bg-blue-700 text-white" : "text-slate-800 hover:bg-slate-200"}`}
        >
          {t(i.key)}
        </Link>
      ))}
    </nav>
  );
}
