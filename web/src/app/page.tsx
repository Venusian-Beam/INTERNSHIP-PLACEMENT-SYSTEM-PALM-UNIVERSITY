import { redirect } from "next/navigation";
import { getMe, homeFor } from "@/lib/server/api";

/** Entry point: send people to their own area, or to sign-in. */
export default async function Home() {
  const me = await getMe();
  redirect(me ? homeFor(me.role) : "/sign-in");
}
