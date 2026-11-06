import { ResetForm } from "./reset-form";

export const metadata = { title: "Reset password · Career Services" };

/** P4: request a link, or (with ?token&email from the email) set a new password. */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, email } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : undefined} email={typeof email === "string" ? email : ""} />;
}
