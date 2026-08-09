import Link from "next/link";
import { ACCENTS, DEFAULT_ACCENT, EFFORT_PILL } from "./accents";
import { getCategoryById, type Post } from "@/lib/blog/posts";

/** Resolves the post's group accent, falling back to its category's. */
function accentOf(post: Post) {
  const category = getCategoryById(post.category);
  const group = category?.groups?.find((g) => g.name === post.group);
  const name = group?.accent ?? category?.accent;
  return name ? ACCENTS[name] : DEFAULT_ACCENT;
}

export function PostCard({
  post,
  showTopic = false,
}: {
  post: Post;
  /** On the mixed-topic index a card needs to say which topic it's from. */
  showTopic?: boolean;
}) {
  const accent = accentOf(post);
  const category = getCategoryById(post.category);

  return (
    <li>
      <Link
        href={`/blog/${post.slug}`}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.04] ${accent.hover}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute -right-10 -top-10 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20 ${accent.glow}`}
        />

        {showTopic && category && (
          <p
            className={`mb-2.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] ${accent.label}`}
          >
            {category.name}
            {post.group ? ` · ${post.group}` : ""}
          </p>
        )}

        <h3 className="font-display text-base font-semibold leading-snug text-mist transition-colors group-hover:text-white">
          {post.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-300">
          {post.excerpt}
        </p>

        <div className="mt-5 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.16em]">
          {post.effort && (
            <span
              className={`rounded-full border px-2 py-0.5 ${EFFORT_PILL[post.effort]}`}
            >
              {post.effort}
            </span>
          )}
          <span className="text-ink-500">{post.readingMinutes} min</span>
          <span
            aria-hidden
            className="ml-auto text-ink-500 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-ink-200"
          >
            →
          </span>
        </div>
      </Link>
    </li>
  );
}
