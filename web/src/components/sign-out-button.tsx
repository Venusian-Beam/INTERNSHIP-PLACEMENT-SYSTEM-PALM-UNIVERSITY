"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { session } from "@/lib/api";
import { Icon } from "./icons";
import { Button } from "./ui";

/**
 * Sign-out trigger + confirmation dialog. Uses the native <dialog> (showModal): it renders in the browser's top
 * layer (above sticky headers and menus), traps focus, closes on Escape and returns focus to the trigger.
 * "Cancel" gets initial focus so an accidental Enter never signs anyone out.
 */
export function SignOutButton({ className = "", icon = false }: { className?: string; icon?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function signOut() {
    setBusy(true);
    await session("logout").catch(() => null);
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {icon ? <Icon name="logout" className="size-4 text-muted" /> : null}
        Sign out
      </button>

      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClose={() => setOpen(false)}
        onCancel={(e) => busy && e.preventDefault()}
        // A click on the backdrop lands on the <dialog> itself (the panel fills it), so it means "cancel".
        onClick={(e) => e.target === e.currentTarget && !busy && setOpen(false)}
        className="m-auto w-[calc(100%-32px)] max-w-[400px] rounded-[var(--radius)] border border-line bg-bg p-0 text-text shadow-[var(--shadow-lg)] backdrop:bg-[rgb(16_24_40/0.45)] backdrop:backdrop-blur-[2px] open:animate-[dialog-in_160ms_ease-out]"
      >
        {open ? (
          <div className="p-6">
            <div className="flex items-start gap-3.5">
              <Icon name="logout" className="mt-0.5 size-6 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0">
                <h2 id={`${id}-title`} className="text-[17px] font-semibold tracking-tight">
                  Sign out?
                </h2>
                <p id={`${id}-desc`} className="mt-1.5 text-[14px] leading-relaxed text-muted">
                  You&apos;ll need to sign in again to continue. Any changes you haven&apos;t saved will be lost.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy} autoFocus>
                Cancel
              </Button>
              <Button variant="dark" onClick={signOut} disabled={busy} aria-busy={busy}>
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
