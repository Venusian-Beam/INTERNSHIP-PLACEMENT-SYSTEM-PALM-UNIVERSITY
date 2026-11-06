import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = { title: "Accept invitation · Career Services" };

/** P6: invited staff, Head or President set their password (FR-A4). */
export default async function AcceptInvitePage({ searchParams }: PageProps<"/accept-invite">) {
  const { token } = await searchParams;
  return <AcceptInviteForm token={typeof token === "string" ? token : ""} />;
}
