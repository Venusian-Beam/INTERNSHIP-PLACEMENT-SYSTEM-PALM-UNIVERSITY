"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const tabs = [
  { href: "/staff/settings/staff-accounts", label: "Staff accounts" },
  { href: "/staff/settings/template", label: "Letter template" },
  { href: "/staff/settings/cycles", label: "Cycles" },
  { href: "/staff/settings/registry-import", label: "Registry import" },
  { href: "/staff/settings/audit", label: "Audit trail" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="-mt-3 mb-7 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-brand text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
