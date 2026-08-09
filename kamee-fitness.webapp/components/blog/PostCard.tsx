import Link from "next/link";
import type { RunPost } from "@/lib/blog/posts";

const EFFORT_STYLES: Record<string, string> = {
  Easy: "border-leaf-500/40 bg-leaf-500/[0.07] text-leaf-300",
  Moderate: "border-sun-500/40 bg-sun-500/[0.07] text-sun-500",
  Hard: "border-ember-500/40 bg-ember-500/[0.07] text-ember-400",
};

export function PostCard({ post }: { post: RunPost }) {
  return (
    <li>
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-leaf-500/40"
      >
        <h3 className="font-display text-base font-semibold text-mist group-hover:text-leaf-300">
          {post.title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-ink-300">{post.excerpt}</p>
        <p className="mt-4 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-ink-400">
          {post.effort && (
            <span
              className={`rounded-full border px-2 py-0.5 ${EFFORT_STYLES[post.effort]}`}
            >
              {post.effort}
            </span>
          )}
          <span>{post.readingMinutes} min read</span>
        </p>
      </Link>
    </li>
  );
}
