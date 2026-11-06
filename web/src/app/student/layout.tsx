import { BrandMark } from "@/components/icons";
import { requireRole } from "@/lib/server/require";
import { StudentMenu } from "./student-menu";

/** Student area: phone-first, simple list + hamburger menu (UI-D2). */
export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const me = await requireRole(["student"]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="relative mx-auto flex h-[60px] w-full max-w-xl items-center gap-3 px-4">
          <BrandMark className="size-11" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-serif text-[15px] font-semibold">Career Services</p>
            <p className="truncate text-[13px] text-muted">{me.name}</p>
          </div>
          <StudentMenu name={me.name} email={me.email} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
