import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Allow .mdx files to be treated as routable/importable page-like modules.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  // No remark/rehype plugins for v1; add remark-gfm later if we want tables/strikethrough.
  options: {},
});

export default withMDX(nextConfig);
