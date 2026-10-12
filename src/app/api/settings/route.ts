import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";

export async function PUT(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (user.role !== "exec") return json({ ok: false, errors: ["err.forbidden"] });
  const b = await req.json();
  mutate((db) => {
    db.settings = {
      commissionBase: b.commissionBase === "net" ? "net" : "sales",
      rateSales: Math.max(0, Number(b.rateSales) || 0),
      rateNet: Math.max(0, Number(b.rateNet) || 0),
      commissionTrigger: ["approval", "delivery", "payment"].includes(b.commissionTrigger) ? b.commissionTrigger : "payment",
      approverSeesCost: !!b.approverSeesCost,
    };
  });
  return json({ ok: true });
}
