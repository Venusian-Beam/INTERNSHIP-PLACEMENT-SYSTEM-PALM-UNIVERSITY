import { NextRequest, NextResponse } from "next/server";
import { devAllowed, mailpitUrl } from "@/lib/server/dev";

/**
 * Local development only: the newest sign-in code sent to one address, for the "Fill in" helper on the
 * sign-in code screen. 404 unless running a dev server with DEV_TOOLS=1 and called from this computer
 * (see lib/server/dev.ts). Codes and emails are also written to the project's logs/ folder by the API.
 */
const notFound = () => NextResponse.json({ message: "Not found." }, { status: 404 });

export async function GET(req: NextRequest) {
  if (!devAllowed(req)) return notFound();
  const email = req.nextUrl.searchParams.get("code_for") ?? "";
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) return notFound();
  try {
    const q = encodeURIComponent(`to:${email} subject:"sign-in code"`);
    const res = await fetch(`${mailpitUrl()}/api/v1/search?query=${q}&limit=1`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error();
    const m = (await res.json()).messages?.[0] as { Subject: string; Created: string } | undefined;
    const code = m?.Subject.match(/sign-in code:\s*(\d{6})/i)?.[1] ?? null;
    return NextResponse.json({ code, at: m?.Created ?? null });
  } catch {
    return NextResponse.json({ message: "The local mail catcher (Mailpit) isn't reachable." }, { status: 502 });
  }
}
