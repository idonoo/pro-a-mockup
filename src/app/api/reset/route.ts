import { apiUser, json, unauthorized } from "@/lib/api";
import { resetDb } from "@/lib/db";

export async function POST() {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (user.role !== "exec") return json({ ok: false, errors: ["err.forbidden"] });
  await resetDb();
  return json({ ok: true });
}
