import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import * as wf from "@/lib/workflow";

// Standard prices and suppliers: purchasing sets / requests, the executive decides
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  return json(
    await mutate((db): wf.Result => {
      switch (b.action) {
        case "set":
          return wf.setStdPrice(db, user, { material: String(b.material), supplierId: String(b.supplierId), price: Number(b.price) });
        case "approve":
          return wf.decidePriceChange(db, user, b.id, true);
        case "reject":
          return wf.decidePriceChange(db, user, b.id, false);
        case "add_supplier":
          return wf.addSupplier(db, user, String(b.name ?? ""));
        default:
          return { ok: false, errors: ["err.generic"] };
      }
    }),
  );
}
