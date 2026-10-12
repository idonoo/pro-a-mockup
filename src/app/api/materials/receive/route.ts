import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import { receiveMaterial } from "@/lib/workflow";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  return json(
    mutate((db) =>
      receiveMaterial(db, user, {
        material: String(b.material),
        qty: Number(b.qty),
        unit: String(b.unit ?? ""),
        date: String(b.date ?? ""),
        poNo: String(b.poNo ?? ""),
        supplierId: String(b.supplierId ?? ""),
        lot: String(b.lot ?? ""),
      }),
    ),
  );
}
