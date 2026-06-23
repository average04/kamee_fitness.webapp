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
};

// No remark/rehype plugins — Turbopack (Next 16) doesn't run them. Heading
// IDs are derived at render time in mdx-components.tsx via slugifyHeading.
const withMDX = createMDX({ options: {} });

export default withMDX(nextConfig);
