import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import { receiveGoods } from "@/lib/workflow";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  const lines = Array.isArray(b.lines) ? b.lines : [];
  return json(
    await mutate((db) =>
      receiveGoods(db, user, {
        date: String(b.date ?? ""),
        poNo: String(b.poNo ?? ""),
        supplierId: String(b.supplierId ?? ""),
        lines: lines.map((l: Record<string, unknown>) => ({
          material: String(l.material),
          qty: Number(l.qty),
          unit: String(l.unit ?? ""),
          lot: String(l.lot ?? ""),
        })),
      }),
    ),
  );
}
