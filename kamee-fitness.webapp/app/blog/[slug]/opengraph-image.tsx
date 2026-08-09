import { ImageResponse } from "next/og";
import { getCategoryById, getPost, POST_SLUGS } from "@/lib/blog/posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kamee Fitness running guide";

export function generateStaticParams() {
  return POST_SLUGS.map((slug) => ({ slug }));
}

// Rendered by Satori, which supports a subset of CSS and no Tailwind — inline
// styles only, and every multi-child container needs an explicit display.
export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  const title = post?.title ?? "Kamee Fitness";
  const categoryName = post ? getCategoryById(post.category)?.name : undefined;
  const eyebrow = [categoryName, post?.group].filter(Boolean).join(" · ") || "Guide";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#07090a",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#9bd2a8",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#eef4f0",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8ea0a3" }}>
          kamee.fit
        </div>
      </div>
    ),
    { ...size },
  );
}
