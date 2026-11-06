import type { NextRequest } from "next/server";

/**
 * Local developer tool: the sign-in code "Fill in" helper (/api/dev/mail?code_for=).
 * Three gates, all required:
 *  1. a development server (NODE_ENV === "development"; a production build is never "development"),
 *  2. DEV_TOOLS=1 in .env.local (opt-in),
 *  3. the request comes from this computer (loopback host and client address), so someone on the
 *     same Wi-Fi can't read sign-in codes off a dev server that listens on all interfaces.
 */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_TOOLS === "1";
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const LOOPBACK_ADDR = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;

export function isLocalRequest(headers: Headers): boolean {
  const host = (headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) return false;
  // The Next dev server records the socket address in x-forwarded-for; anything non-loopback is refused.
  const fwd = headers.get("x-forwarded-for");
  if (fwd && !fwd.split(",").every((a) => LOOPBACK_ADDR.test(a.trim()))) return false;
  return true;
}

export function devAllowed(req: NextRequest | { headers: Headers }): boolean {
  return devToolsEnabled() && isLocalRequest(req.headers);
}

export const mailpitUrl = () => process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
