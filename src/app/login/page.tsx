import { LangToggle } from "@/components/LangToggle";
import { LoginCard } from "@/components/LoginCard";
import { loadDb } from "@/lib/db";
import { makeT } from "@/lib/i18n-core";
import { getLang, homeFor } from "@/lib/session";

export default async function LoginPage() {
  const t = makeT(await getLang());
  const { users } = loadDb();
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold text-blue-800">Pro A</h1>
          <p className="mt-2 text-2xl text-slate-600">{t("app.sub")}</p>
        </div>
        <LangToggle />
      </div>
      <p className="mb-4 text-2xl font-semibold">{t("login.pick")}</p>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <LoginCard key={u.id} userId={u.id} name={u.name} role={u.role} home={homeFor(u.role)} />
        ))}
      </div>
      <p className="mt-8 text-base text-slate-500">{t("login.note")}</p>
    </main>
  );
}
