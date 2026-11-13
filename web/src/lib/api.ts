/**
 * Browser-side API client. Every call goes through the Next.js proxy (/api/proxy/...), never straight to Laravel.
 * The proxy adds the session token from the HttpOnly cookie (AD8).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
    public code?: string,
  ) {
    super(message);
  }
  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
  };
  if (!res.ok) {
    const msg =
      res.status === 429
        ? "Too many attempts. Wait a minute and try again."
        : (data.message ?? `Something went wrong (${res.status}).`);
    throw new ApiError(res.status, msg, data.errors ?? {}, data.code);
  }
  return data as T;
}

let redirecting = false;

/**
 * Asks the API whether this browser's session is still valid. If it ended, sends the user to sign in with the reason:
 * `replaced` when the account signed in on another device (one device at a time), otherwise `expired`.
 * Never signs anyone out itself; a network error leaves the page alone.
 */
export async function checkSession(): Promise<void> {
  if (typeof window === "undefined" || redirecting || PUBLIC_PAGE.test(window.location.pathname)) return;
  const res = await fetch("/api/proxy/auth/me", { headers: { Accept: "application/json" }, cache: "no-store" }).catch(() => null);
  if (res?.status !== 401 || redirecting || PUBLIC_PAGE.test(window.location.pathname)) return;
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  redirecting = true;
  // A full page load on purpose: it drops every piece of in-memory state from the ended session.
  window.location.assign(body.code === "session_replaced" ? "/sign-in?replaced=1" : "/sign-in?expired=1");
}
const PUBLIC_PAGE = /^\/(sign-in|register|verify-email|reset-password|accept-invite|login-code)(\/|$)/;

/**
 * Calls the API through the proxy. A 401 means the session ended (expired, or the demo data was reset): go to the
 * sign-in page instead of showing "Unauthenticated." on screen.
 * A 401 can also be stale: a request started before a sign-out can come back after someone else has signed in on
 * this tab. So the session is re-checked first, and nothing happens if it is valid now (never sign anyone out here).
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(`/api/proxy/${path.replace(/^\//, "")}`, init);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && typeof window !== "undefined" && !redirecting && !PUBLIC_PAGE.test(window.location.pathname)) {
      await checkSession();
    }
    throw e;
  }
}

export function post<T>(path: string, body?: unknown, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST"): Promise<T> {
  return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** Session endpoints (set/clear the HttpOnly cookie). */
export function session<T>(action: "login" | "otp" | "logout", body?: unknown): Promise<T> {
  return request<T>(`/api/auth/${action}`, { method: "POST", body: JSON.stringify(body ?? {}) });
}
