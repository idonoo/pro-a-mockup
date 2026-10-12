import { cookies } from "next/headers";
import { loadDb } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await req.json();
  const user = loadDb().users.find((u) => u.id === userId);
  if (!user) return Response.json({ ok: false, errors: ["err.forbidden"] }, { status: 400 });
  (await cookies()).set("uid", user.id, { path: "/", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true, role: user.role });
}

export async function DELETE() {
  (await cookies()).delete("uid");
  return Response.json({ ok: true });
}
