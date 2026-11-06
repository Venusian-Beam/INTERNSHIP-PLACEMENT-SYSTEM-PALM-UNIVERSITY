"use client";

import { createContext, useContext, type ReactNode } from "react";

/** The signed-in staff member, provided once by the staff layout so pages don't re-fetch auth/me. */
export type StaffUser = { name: string; email: string; role: "staff" | "head" };

const Ctx = createContext<StaffUser | null>(null);

export function StaffUserProvider({ user, children }: { user: StaffUser; children: ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useStaffUser(): StaffUser {
  const u = useContext(Ctx);
  if (!u) throw new Error("useStaffUser must be used inside the staff layout");
  return u;
}
