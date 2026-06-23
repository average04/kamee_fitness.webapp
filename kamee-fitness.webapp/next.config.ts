import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// Supabase Storage host for the public exercise-demos bucket (next/image).
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
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
