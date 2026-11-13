import { redirect } from "next/navigation";
import { apiFetch, getMe, homeFor, sessionToken, type Me, type Role } from "./api";

/** Only asked after a failed session check: did the API end this session because the account signed in elsewhere? */
async function sessionWasReplaced(): Promise<boolean> {
  const token = await sessionToken();
  if (!token) return false;
  const res = await apiFetch("auth/me", {}, token).catch(() => null);
  if (res?.status !== 401) return false;
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  return body.code === "session_replaced";
}

/**
 * Area guard for layouts and pages. This is a convenience for routing only: the real authorisation
 * happens on every API call in Laravel (NFR-S1), so a bypassed UI still cannot read or change data.
 */
export async function requireRole(roles: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect((await sessionWasReplaced()) ? "/sign-in?replaced=1" : "/sign-in");
  if (!roles.includes(me.role)) redirect(homeFor(me.role));
  return me;
}
