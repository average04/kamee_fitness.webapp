import type { AccentName } from "@/lib/blog/posts";

/**
 * One palette entry per accent, drawn from the existing tokens so the blog
 * reads as the same product: leaf = the brand base, ember = intensity,
 * teal = the outdoor/GPS identity, sun = celebration.
 * Class strings must stay literal for Tailwind to detect them.
 */
export type Accent = {
  pill: string;
  label: string;
  glow: string;
  hover: string;
  ring: string;
};

export const ACCENTS: Record<AccentName, Accent> = {
  leaf: {
    pill: "border-leaf-500/40 bg-leaf-500/[0.08] text-leaf-300",
    label: "text-leaf-300",
    glow: "bg-leaf-500",
    hover: "hover:border-leaf-500/50",
    ring: "border-leaf-500/25",
  },
  ember: {
    pill: "border-ember-500/40 bg-ember-500/[0.08] text-ember-400",
    label: "text-ember-400",
    glow: "bg-ember-500",
    hover: "hover:border-ember-500/50",
    ring: "border-ember-500/25",
  },
  teal: {
    pill: "border-teal-500/40 bg-teal-500/[0.08] text-teal-500",
    label: "text-teal-500",
    glow: "bg-teal-500",
    hover: "hover:border-teal-500/50",
    ring: "border-teal-500/25",
  },
  sun: {
    pill: "border-sun-500/40 bg-sun-500/[0.08] text-sun-500",
    label: "text-sun-500",
    glow: "bg-sun-500",
    hover: "hover:border-sun-500/50",
    ring: "border-sun-500/25",
  },
};

export const DEFAULT_ACCENT = ACCENTS.leaf;

export const EFFORT_PILL: Record<string, string> = {
  Easy: "border-leaf-500/30 text-leaf-300/90",
  Moderate: "border-sun-500/30 text-sun-500/90",
  Hard: "border-ember-500/30 text-ember-400/90",
};

/** Accent for a post: its group's, falling back to its category's. */
export function accentFor(
  groupAccent: AccentName | undefined,
  categoryAccent: AccentName | undefined,
): Accent {
  return ACCENTS[groupAccent ?? categoryAccent ?? "leaf"];
}
