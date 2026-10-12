import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import type { OrderInput } from "@/lib/types";
import { createOrder } from "@/lib/workflow";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const input = (await req.json()) as OrderInput;
  return json(mutate((db) => createOrder(db, user, input)), 201);
}
