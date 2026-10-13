import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import { addMaterial } from "@/lib/workflow";

// Purchasing (or the executive) adds a new material / spare part to the master list
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  return json(
    await mutate((db) =>
      addMaterial(db, user, {
        nameTh: b.nameTh,
        nameEn: b.nameEn,
        category: b.category,
        unit: b.unit,
        altUnit: b.altUnit,
        factor: Number(b.factor) || undefined,
        price: Number(b.price) || 0,
      }),
    ),
    201,
  );
}
