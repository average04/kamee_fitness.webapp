import type { NextConfig } from "next";
import createMDX from "@next/mdx";

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
};

// No remark/rehype plugins — Turbopack (Next 16) doesn't run them. Heading
// IDs are derived at render time in mdx-components.tsx via slugifyHeading.
const withMDX = createMDX({ options: {} });

export default withMDX(nextConfig);
