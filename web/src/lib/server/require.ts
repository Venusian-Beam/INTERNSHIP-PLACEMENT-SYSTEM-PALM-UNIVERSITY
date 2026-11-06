import { redirect } from "next/navigation";
import { getMe, homeFor, type Me, type Role } from "./api";

/**
 * Area guard for layouts and pages. This is a convenience for routing only: the real authorisation
 * happens on every API call in Laravel (NFR-S1), so a bypassed UI still cannot read or change data.
 */
export async function requireRole(roles: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!roles.includes(me.role)) redirect(homeFor(me.role));
  return me;
}
