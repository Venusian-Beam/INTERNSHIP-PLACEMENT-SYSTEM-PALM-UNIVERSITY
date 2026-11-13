"use client";

import { useEffect } from "react";
import { checkSession } from "@/lib/api";

const EVERY_MS = 30_000;

/**
 * One device at a time: when the account signs in somewhere else, the API ends this session. This notices within
 * 30 seconds (or as soon as the tab is looked at again) and sends the user to the sign-in page with the reason,
 * even if they are only reading and make no requests. Checks pause while the tab is hidden.
 */
export function SessionWatch() {
  useEffect(() => {
    const check = () => document.visibilityState === "visible" && void checkSession();
    const timer = window.setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
