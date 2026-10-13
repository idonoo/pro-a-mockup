import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import { saveDailyScrap } from "@/lib/workflow";

// Production records the day's scrap (one record per date)
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const b = await req.json();
  return json(await mutate((db) => saveDailyScrap(db, user, { date: b.date, steelKg: Number(b.steelKg), plasticKg: Number(b.plasticKg), poRefs: b.poRefs ?? [], fg: b.fg ?? [] })));
}
