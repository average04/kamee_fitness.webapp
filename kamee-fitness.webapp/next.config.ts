import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { configuredLocalLoginOrigin } from "./lib/auth/local-login-origin";
import { coachingPreviewBuildExposure } from "./lib/coaching/conversation/preview-build";

// Supabase Storage host for the public exercise-demos bucket (next/image).
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Bake the same sanitized exposure value into server and browser bundles.
  // Never publish a service credential or trust a browser-supplied rollout tier.
  env: {
    NEXT_PUBLIC_COACHING_EXPOSURE: coachingPreviewBuildExposure({
      context: process.env.CONTEXT,
      requested: process.env.KAMEE_COACHING_PREVIEW,
      localQa: process.env.KAMEE_COACHING_LOCAL_QA,
      siteUrl: process.env.SITE_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }),
  },
  // Keep the opt-in loopback alias redirect absolute; Next otherwise relativizes it.
  skipProxyUrlNormalize: configuredLocalLoginOrigin(process.env.NODE_ENV, process.env.SITE_URL) !== null,
  // Allow .mdx files to be treated as routable/importable page-like modules.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: {
    // Demo images are up to 10 MB (matches the exercise-demos bucket limit);
    // the default Server Action body limit is 1 MB.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: supabaseHost
    ? { remotePatterns: [{ protocol: "https", hostname: supabaseHost }] }
    : undefined,
  async headers() {
    // Global security response headers. The CSP here intentionally sets only
    // the "safe" directives that don't govern <script> (so it can't break
    // Next's framework inline scripts) — a full nonce-based script-src CSP is a
    // separate, tested follow-up.
    return [
      {
        // Public plan pages are dynamic SSR; the CDN cache is the cost
        // defense (same staleness contract as /api/plans). Applies to the
        // route's 404s too, so a just-published plan's page can lag up to an
        // hour — consistent with the documented feed behavior.
        source: "/plans/:id",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300" },
          {
            key: "Netlify-CDN-Cache-Control",
            value: "public, durable, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

// No remark/rehype plugins — Turbopack (Next 16) doesn't run them. Heading
// IDs are derived at render time in mdx-components.tsx via slugifyHeading.
const withMDX = createMDX({ options: {} });

export default withMDX(nextConfig);
