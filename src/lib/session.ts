import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadDb } from "./db";
import type { Lang, Role, Settings, User } from "./types";

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("lang")?.value === "en" ? "en" : "th";
}

export async function getUserOrNull(): Promise<User | null> {
  const c = await cookies();
  const id = c.get("uid")?.value;
  return id ? ((await loadDb()).users.find((u) => u.id === id) ?? null) : null;
}

export async function requireUser(...roles: Role[]): Promise<User> {
  const u = await getUserOrNull();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect("/");
  return u;
}

export const homeFor = (role: Role) =>
  ({ sales: "/orders", approver: "/approvals", production: "/production", store: "/store", purchasing: "/purchasing", exec: "/dashboard" })[role];

export const canSeeCost = (role: Role, s: Settings) => role === "exec" || (role === "approver" && s.approverSeesCost);
export const canSeeUnitCost = (role: Role) => role === "exec" || role === "purchasing";
export const canSeePrice = (role: Role) => role === "sales" || role === "exec" || role === "approver";
