import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF defence for cookie-authenticated route handlers: state-changing requests must come from this site.
 * (The session cookie is also SameSite=Lax.)
 */
export function sameOrigin(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbidden(message = "Forbidden.") {
  return NextResponse.json({ message }, { status: 403 });
}
