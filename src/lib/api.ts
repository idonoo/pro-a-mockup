import { getUserOrNull } from "./session";
import type { Result } from "./workflow";

export const json = (r: Result | { ok: boolean; errors?: string[] }, status = 200) => Response.json(r, { status: r.ok ? status : 400 });

export async function apiUser() {
  return getUserOrNull();
}

export const unauthorized = () => Response.json({ ok: false, errors: ["err.forbidden"] }, { status: 401 });
