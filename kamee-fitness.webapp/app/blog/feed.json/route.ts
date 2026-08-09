import { buildBlogFeed } from "@/lib/blog/feed";

// Baked at build time like the sitemap — the registry is static.
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildBlogFeed(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300",
    },
  });
}
