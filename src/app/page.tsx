import { redirect } from "next/navigation";
import { getUserOrNull, homeFor } from "@/lib/session";

export default async function Home() {
  const u = await getUserOrNull();
  redirect(u ? homeFor(u.role) : "/login");
}
