"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark, Icon, type IconName } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { cx } from "@/components/ui";

const items: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/staff", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/staff/students", label: "Students", icon: "people" },
  { href: "/staff/applications", label: "Applications", icon: "clipboard" },
  { href: "/staff/organisations", label: "Organisations", icon: "buildings" },
  { href: "/staff/letters", label: "Letters", icon: "mail" },
  { href: "/staff/placements", label: "Placements", icon: "briefcase" },
  { href: "/staff/reports", label: "Reports", icon: "report" },
];

/** Staff header (UI-D11): white two-row bar. Row 1: brand, search, cycle, actions, account. Row 2: centred navigation. */
export function StaffNav({ name, email, isHead, cycleName }: { name: string; email: string; isHead: boolean; cycleName: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const all = isHead ? [...items, { href: "/staff/settings", label: "Settings", icon: "settings" as IconName }] : items;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const isActive = (n: { href: string; exact?: boolean }) => (n.exact ? path === n.href : path.startsWith(n.href));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setOpen(false);
      }
      // "/" jumps to search (unless the user is already typing somewhere).
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex h-[60px] w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/staff" className="flex items-center gap-2.5 whitespace-nowrap" onClick={() => setOpen(false)}>
          <BrandMark className="size-11" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[14px] font-semibold">Career Services</span>
            <span className="block text-[11px] text-muted">Internship placement</span>
          </span>
        </Link>

        <form
          role="search"
          className="relative ml-2 hidden w-full max-w-[340px] md:block"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/staff/students${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`);
          }}
        >
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
            className="h-10 w-full rounded-full border border-line bg-surface/60 pr-12 pl-10 text-[13px] placeholder:text-faint focus:border-brand focus:bg-bg focus:outline-none"
          />
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-[5px] border border-line bg-bg px-1.5 py-0.5 text-[11px] text-muted">/</kbd>
        </form>

        <div className="ml-auto flex items-center gap-2">
          {cycleName ? (
            <span className="hidden items-center gap-1.5 rounded-[8px] border border-line px-3 py-2 text-[12.5px] font-medium lg:inline-flex">
              <Icon name="calendar" className="size-4 text-[var(--c-indigo)]" />
              {cycleName}
            </span>
          ) : null}
          <Link
            href="/staff/letters"
            className="hidden items-center gap-2 rounded-[8px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-ink shadow-[var(--shadow)] hover:bg-brand-strong sm:inline-flex"
          >
            <span className="grid size-5 place-items-center rounded-full bg-white/20">
              <Icon name="send" className="size-3" />
            </span>
            Send letters
          </Link>
          <Link href="/staff/reports" title="Reports" aria-label="Reports" className="hidden size-9 place-items-center rounded-[8px] border border-line text-muted hover:bg-surface hover:text-text sm:grid">
            <Icon name="chart" className="size-[18px]" />
          </Link>

          <div className="relative" ref={menuRef}>
            <button type="button" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-[8px] p-1 pr-2 hover:bg-surface">
              <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--c-indigo)] text-[12px] font-semibold text-white">{initials}</span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block text-[13px] font-medium">{name}</span>
                <span className="block text-[11px] text-muted">{isHead ? "Head of Career Services" : "Career Services"}</span>
              </span>
              <Icon name="chevronDown" className="size-4 text-muted" />
            </button>
            {menu ? (
              <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-line bg-bg shadow-[var(--shadow-lg)]">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="truncate text-[12.5px] text-muted">{email}</p>
                </div>
                <div className="p-1">
                  <SignOutButton className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-sm hover:bg-surface" icon />
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[8px] border border-line lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} className="size-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Career Services" className="hidden border-t border-line lg:block">
        <div className="mx-auto flex h-12 max-w-[1400px] items-stretch justify-center gap-1 px-6">
          {all.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n) ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-2 px-3.5 text-[13px] transition-colors",
                isActive(n) ? "font-semibold text-brand" : "text-muted hover:text-text",
              )}
            >
              <Icon name={n.icon} className="size-[17px]" />
              {n.label}
              {isActive(n) ? <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand" aria-hidden /> : null}
            </Link>
          ))}
        </div>
      </nav>

      {open ? (
        <div className="border-t border-line px-2 py-2 lg:hidden">
          {all.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(n) ? "page" : undefined}
              className={cx("flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px]", isActive(n) ? "bg-brand-soft font-semibold text-brand" : "text-muted")}
            >
              <Icon name={n.icon} className="size-[18px]" />
              {n.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
