import { BrandMark, Icon } from "@/components/icons";
import { SessionWatch } from "@/components/session-watch";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/server/require";

/** President area: a single template-review page; nothing else in navigation (D3). */
export default async function PresidentLayout({ children }: LayoutProps<"/president">) {
  const me = await requireRole(["president"]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SessionWatch />
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <BrandMark className="size-11" />
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold">University Career Services</span>
              <span className="block text-[11px] text-muted">Letter template review</span>
            </span>
          </span>
          <span className="flex items-center gap-3 text-[13px]">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--c-indigo)] text-white">
                <Icon name="shield" className="size-4" />
              </span>
              <span className="font-medium">{me.name}</span>
            </span>
            <SignOutButton className="inline-flex items-center gap-1.5 rounded-[8px] border border-line px-3 py-1.5 font-medium hover:bg-surface" icon />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
