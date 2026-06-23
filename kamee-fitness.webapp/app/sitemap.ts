import type { MetadataRoute } from "next";

const SITE = "https://kamee.fit";

// Public, indexable pages only — the /me, /admin, /login, /api, /auth areas are
// private or non-content and stay out of the sitemap (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/delete-account`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
