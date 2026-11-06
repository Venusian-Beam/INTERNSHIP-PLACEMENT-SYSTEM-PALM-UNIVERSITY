import { NextRequest, NextResponse } from "next/server";
import { apiFetch, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/server/api";
import { forbidden, sameOrigin } from "@/lib/server/guard";

/**
 * Session endpoints. Login and code verification are the ONLY places a Sanctum token is received;
 * it goes straight into an HttpOnly cookie and is never returned to the browser (AD8).
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/auth/[action]">) {
  if (!sameOrigin(req)) return forbidden();
  const { action } = await ctx.params;

  if (action === "logout") {
    const token = await sessionToken();
    if (token) await apiFetch("auth/logout", { method: "POST" }, token).catch(() => null);
    const res = NextResponse.json({ message: "Signed out." });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (action !== "login" && action !== "otp") return NextResponse.json({ message: "Not found." }, { status: 404 });

  const body = await req.text();
  const upstream = await apiFetch(`auth/${action}`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (upstream.ok && typeof data.token === "string") {
    const { token, ...rest } = data;
    const res = NextResponse.json(rest);
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  }

  return NextResponse.json(data, { status: upstream.status });
}
