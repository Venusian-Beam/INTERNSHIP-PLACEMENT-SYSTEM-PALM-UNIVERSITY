/**
 * Server-only helpers for talking to the Laravel API (AD8 backend-for-frontend).
 * The Sanctum token lives in an HttpOnly cookie that browser JavaScript can never read.
 * Never import this file from a client component.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "ips_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // matches SANCTUM_TOKEN_MINUTES (480)

export type Role = "student" | "staff" | "head" | "president";
export type Me = {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** The current placement cycle (returned by the same auth/me call). */
  cycle?: { id: number; name: string } | null;
  profile: null | {
    id: number;
    full_name: string;
    programme: string | null;
    level: number | null;
    student_number: string | null;
    phone: string | null;
    on_registry: boolean;
    has_cv: boolean;
  };
};

function apiBase(): string {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error("API_BASE_URL is not set");
  return base.replace(/\/$/, "");
}

/**
 * The end user's IP, forwarded so Laravel's per-IP rate limits apply to them (TrustBff).
 * QA-1-01: only a header set by the hosting platform can be trusted (on Vercel, CLIENT_IP_HEADER=x-real-ip).
 * Any header a client can send itself (e.g. X-Forwarded-For on a plain Node server) would let attackers rotate
 * fake IPs past the rate limits. Without a trusted header we forward nothing, so limits apply per server
 * (stricter, never weaker).
 */
export async function clientIp(): Promise<string | null> {
  const name = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!name) return null;
  const value = (await headers()).get(name)?.split(",")[0]?.trim();
  return value || null;
}

export async function apiFetch(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
  const h = new Headers(init.headers);
  h.set("Accept", "application/json");
  h.set("X-BFF-Key", process.env.BFF_SHARED_KEY ?? "");
  const ip = await clientIp();
  if (ip) h.set("X-Client-IP", ip);
  if (token) h.set("Authorization", `Bearer ${token}`);
  // SEC-06: never wait on a hung API forever (a letter send with SMTP takes seconds, not minutes).
  return fetch(`${apiBase()}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: h,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
}

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in user for this request, or null. Cached per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const res = await apiFetch("auth/me", {}, token);
  if (!res.ok) return null;
  const j = (await res.json()) as { user: Me; cycle?: { id: number; name: string } | null };
  return { ...j.user, cycle: j.cycle ?? null };
});

export function homeFor(role: Role): string {
  return role === "student" ? "/student" : role === "president" ? "/president" : "/staff";
}
