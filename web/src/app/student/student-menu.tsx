"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { cx } from "@/components/ui";

const menu: { href: string; label: string; icon: IconName }[] = [
  { href: "/student", label: "Home", icon: "home" },
  { href: "/student/apply", label: "Apply", icon: "doc" },
  { href: "/student/documents", label: "Documents", icon: "folder" },
  { href: "/student/profile", label: "Profile", icon: "user" },
];

/** Hamburger menu (UI-D2): a sheet under the header with large touch targets. */
export function StudentMenu({ name, email }: { name: string; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-10 place-items-center rounded-[var(--radius)] border border-line text-text hover:bg-surface"
      >
        <Icon name={open ? "close" : "menu"} className="size-5" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 top-[61px] z-10 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <nav className="absolute inset-x-0 top-full z-20 border-b border-line bg-bg px-3 pt-2 pb-3 shadow-[var(--shadow-lg)]">
            <div className="mb-2 border-b border-line px-3 pt-1 pb-3">
              <p className="font-semibold">{name}</p>
              <p className="truncate text-[13px] text-muted">{email}</p>
            </div>
            {menu.map((m) => {
              const active = m.href === "/student" ? path === m.href : path.startsWith(m.href);
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cx("flex items-center gap-3 rounded-[var(--radius)] px-3 py-3 text-[15px] font-medium", active ? "bg-brand-soft text-brand" : "hover:bg-surface")}
                >
                  <Icon name={m.icon} className="size-5" />
                  {m.label}
                </Link>
              );
            })}
            <SignOutButton className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-3 text-left text-[15px] font-medium text-muted hover:bg-surface" icon />
          </nav>
        </>
      ) : null}
    </>
  );
}
