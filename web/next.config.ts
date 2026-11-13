import type { NextConfig } from "next";

/**
 * SEC-01: security headers on every response.
 * - Pages get a per-request nonce CSP from src/proxy.ts (SEC-07). The fixed policy below covers route handlers
 *   (/api/*: JSON, CSV, files); proxied letter previews replace it with the API's own `default-src 'none'` policy.
 * - frame-ancestors/X-Frame-Options stop clickjacking of staff and President actions; previews are same-origin iframes.
 * - Referrer-Policy no-referrer keeps reset/invite tokens in URLs from leaking.
 */
const dev = process.env.NODE_ENV !== "production";

const routeCsp = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "frame-ancestors 'self'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // cacheComponents off: every page is per-user and authenticated (see context/progress-tracker.md).
  poweredByHeader: false,
  // Vercel multi-service deploy (vercel.json "services"): /_next/image is routed to the app as a page and 404s,
  // which broke every <Image>. Serve the (static, local) images directly instead of through the optimizer.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: routeCsp }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
