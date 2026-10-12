import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import { updateMaster } from "@/lib/workflow";

// Executive edits steel / PE kg-per-metre of one spec table
export async function PUT(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  const spec = b.spec === "innovation" ? "innovation" : "tis";
  const rows = (b.rows ?? []).map((r: { diameter: number; steel: number; pe: number }) => ({ diameter: Number(r.diameter), steel: Number(r.steel), pe: Number(r.pe) }));
  return json(mutate((db) => updateMaster(db, user, spec, rows)));
}
