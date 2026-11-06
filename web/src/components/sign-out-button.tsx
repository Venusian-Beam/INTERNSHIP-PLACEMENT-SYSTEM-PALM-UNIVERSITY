"use client";

import { useRouter } from "next/navigation";
import { session } from "@/lib/api";
import { Icon } from "./icons";

export function SignOutButton({ className = "", icon = false }: { className?: string; icon?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await session("logout").catch(() => null);
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      {icon ? <Icon name="logout" className="size-4 text-muted" /> : null}
      Sign out
    </button>
  );
}
