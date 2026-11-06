import { NextRequest, NextResponse } from "next/server";
import { apiFetch, sessionToken } from "@/lib/server/api";
import { forbidden, sameOrigin } from "@/lib/server/guard";

/**
 * Backend-for-frontend proxy (AD8): the browser calls /api/proxy/<path>; this adds the Sanctum token from the
 * HttpOnly cookie and forwards to Laravel. Token-issuing endpoints are blocked here so a token can never be
 * returned to browser JavaScript (they go through /api/auth/* instead).
 */
const BLOCKED = [/^auth\/(login|otp|logout)$/];
const SEGMENT = /^[A-Za-z0-9._-]+$/;
const PASS_HEADERS = ["content-type", "content-disposition", "content-security-policy"];

async function forward(req: NextRequest, ctx: RouteContext<"/api/proxy/[...path]">) {
  if (!sameOrigin(req)) return forbidden();
  const { path } = await ctx.params;
  if (!path.length || path.some((s) => !SEGMENT.test(s) || s === "." || s === "..")) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  const joined = path.join("/");
  if (BLOCKED.some((re) => re.test(joined))) return NextResponse.json({ message: "Not found." }, { status: 404 });

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await apiFetch(
    joined + req.nextUrl.search,
    {
      method: req.method,
      body: hasBody ? await req.text() : undefined,
      headers: hasBody ? { "Content-Type": req.headers.get("content-type") ?? "application/json" } : undefined,
    },
    await sessionToken(),
  );

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "no-store");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
