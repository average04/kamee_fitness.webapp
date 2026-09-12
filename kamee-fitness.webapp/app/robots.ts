import type { MetadataRoute } from "next";

const SITE = "https://kamee.fit";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/me", "/login", "/api", "/auth", "/coaching"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
