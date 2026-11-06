import { headers } from "next/headers";
import { Alert } from "@/components/ui";
import { devAllowed } from "@/lib/server/dev";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Career Services" };

const notices: Record<string, { tone: "ok" | "bad" | "info"; text: string }> = {
  "1": { tone: "ok", text: "Email confirmed. You can sign in now." },
  invalid: { tone: "bad", text: "That confirmation link is invalid or has expired. Sign in to get a new one." },
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { verified, expired } = await searchParams;
  const notice = expired ? { tone: "info" as const, text: "Your session has ended. Please sign in again." } : typeof verified === "string" ? notices[verified] : undefined;
  return (
    <div className="grid gap-4">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <SignInForm devTools={devAllowed({ headers: await headers() })} />
    </div>
  );
}
