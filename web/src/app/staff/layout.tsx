import { requireRole } from "@/lib/server/require";
import { StaffNav } from "./staff-nav";
import { StaffUserProvider } from "./staff-user";

/** Career Services area (staff + Head): desktop-first, white two-row header (UI-D11). */
export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  // One API call: auth/me returns the user and the current cycle name for the header.
  const me = await requireRole(["staff", "head"]);
  const role = me.role === "head" ? "head" : "staff";
  return (
    <StaffUserProvider user={{ name: me.name, email: me.email, role }}>
      <div className="flex min-h-full flex-1 flex-col">
        <StaffNav name={me.name} email={me.email} isHead={role === "head"} cycleName={me.cycle?.name ?? null} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </StaffUserProvider>
  );
}
