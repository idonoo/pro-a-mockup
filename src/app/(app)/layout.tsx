import { AppShell } from "@/components/AppShell";
import { LangToggle } from "@/components/LangToggle";
import { NavLinks } from "@/components/NavLinks";
import { SwitchUser } from "@/components/SwitchUser";
import { makeT } from "@/lib/i18n-core";
import { getLang, requireUser } from "@/lib/session";
import type { Role } from "@/lib/types";

const NAV: Record<Role, { href: string; key: string }[]> = {
  sales: [
    { href: "/orders", key: "nav.myOrders" },
    { href: "/orders/new", key: "nav.newOrder" },
  ],
  approver: [
    { href: "/approvals", key: "nav.approvals" },
    { href: "/orders", key: "nav.allOrders" },
  ],
  production: [
    { href: "/production", key: "nav.production" },
    { href: "/production/scrap", key: "nav.scrap" },
  ],
  store: [
    { href: "/store", key: "nav.stock" },
    { href: "/store/issues", key: "nav.issues" },
    { href: "/store/materials", key: "nav.materials" },
    { href: "/store/finish", key: "nav.finish" },
  ],
  purchasing: [
    { href: "/purchasing", key: "nav.purchasing" },
    { href: "/purchasing/items", key: "nav.items" },
    { href: "/store", key: "nav.stock" },
  ],
  exec: [
    { href: "/dashboard", key: "nav.dashboard" },
    { href: "/cost-approvals", key: "nav.costApprovals" },
    { href: "/orders", key: "nav.allOrders" },
    { href: "/store", key: "nav.stock" },
    { href: "/settings", key: "nav.settings" },
  ],
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = makeT(await getLang());
  return (
    <AppShell
      sidebar={
        <>
          <div className="mb-6">
            <div className="text-2xl font-bold text-blue-800">Pro A</div>
            <div className="text-base text-slate-500">{t("app.sub")}</div>
          </div>
          <NavLinks items={NAV[user.role]} />
        </>
      }
      headerLeft={
        <>
          <div className="text-xl font-bold">{user.name}</div>
          <div className="text-base text-slate-600">{t(`role.${user.role}`)}</div>
        </>
      }
      headerRight={
        <>
          <LangToggle />
          <SwitchUser />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
