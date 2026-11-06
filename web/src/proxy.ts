import { NextResponse, type NextRequest } from "next/server";

/**
 * SEC-07: per-request nonce Content-Security-Policy for every page (replaces script-src 'unsafe-inline').
 * Next.js reads the nonce from the request's CSP header and stamps it on its own scripts; 'strict-dynamic' lets
 * those trusted scripts load the page chunks. An injected <script> has no nonce, so the browser refuses it.
 * Styles keep 'unsafe-inline': React style attributes (chart bars) can't carry a nonce, and CSS can't run code.
 * Pages are all dynamically rendered (root layout awaits connection()), which nonces require.
 */
const dev = process.env.NODE_ENV !== "production";
const storage = process.env.STORAGE_ORIGIN ?? "http://127.0.0.1:9000";

export function buildPageCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${storage}${dev ? " ws: wss:" : ""}`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildPageCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: route handlers (/api/*) and static assets get the fixed policy from next.config.ts.
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
