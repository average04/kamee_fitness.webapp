import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import { planWebUrl } from "@/lib/public-plans";

const SITE = "https://kamee.fit";

// Public, indexable pages only — the /me, /admin, /login, /api, /auth areas are
// private or non-content and stay out of the sitemap (see robots.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticPages: MetadataRoute.Sitemap = [
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

  // Published plan pages. Generated at build time, so new plans appear on the
  // next deploy — fine, since content changes ship via deploys anyway. A
  // failed query degrades to the static list instead of breaking the sitemap.
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, updated_at")
      .eq("is_published", true)
      .eq("review_status", "approved");
    if (error) throw new Error(error.message);

    const planPages: MetadataRoute.Sitemap = (data ?? []).map((row) => ({
      url: planWebUrl(row.id),
      lastModified: new Date(row.updated_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    return [...staticPages, ...planPages];
  } catch (err) {
    console.error("sitemap: plan pages skipped:", err);
    return staticPages;
  }
}
