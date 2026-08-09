import type { PostGroup } from "@/lib/blog/posts";

/**
 * One accent per group, drawn from the existing token palette so the blog
 * reads as the same product: leaf = the brand base, ember = intensity,
 * teal = the outdoor/GPS identity, sun = celebration.
 * Class strings must stay literal for Tailwind to detect them.
 */
export type GroupAccent = {
  pill: string;
  label: string;
  glow: string;
  hover: string;
};

export const GROUP_ACCENT: Record<PostGroup, GroupAccent> = {
  Foundation: {
    pill: "border-leaf-500/40 bg-leaf-500/[0.08] text-leaf-300",
    label: "text-leaf-300",
    glow: "bg-leaf-500",
    hover: "hover:border-leaf-500/50",
  },
  Speed: {
    pill: "border-ember-500/40 bg-ember-500/[0.08] text-ember-400",
    label: "text-ember-400",
    glow: "bg-ember-500",
    hover: "hover:border-ember-500/50",
  },
  Strength: {
    pill: "border-teal-500/40 bg-teal-500/[0.08] text-teal-500",
    label: "text-teal-500",
    glow: "bg-teal-500",
    hover: "hover:border-teal-500/50",
  },
  Race: {
    pill: "border-sun-500/40 bg-sun-500/[0.08] text-sun-500",
    label: "text-sun-500",
    glow: "bg-sun-500",
    hover: "hover:border-sun-500/50",
  },
};

export const EFFORT_PILL: Record<string, string> = {
  Easy: "border-leaf-500/30 text-leaf-300/90",
  Moderate: "border-sun-500/30 text-sun-500/90",
  Hard: "border-ember-500/30 text-ember-400/90",
};
