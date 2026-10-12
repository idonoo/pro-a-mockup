import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import type { OrderInput } from "@/lib/types";
import { resubmitOrder } from "@/lib/workflow";

// Sales fixes a rejected order and sends it for approval again
export async function PUT(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const input = (await req.json()) as OrderInput;
  return json(mutate((db) => resubmitOrder(db, user, id, input)));
}
