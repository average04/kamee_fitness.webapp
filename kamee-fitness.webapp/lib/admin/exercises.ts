/**
 * Types and pure helpers for the exercise catalog admin. No I/O — safe to
 * unit-test and to import from both client and server modules.
 */

export type ExerciseInput = {
  name: string;
  slug: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string[];
  cues: string[];
  common_mistakes: string[];
  demo_image_path: string | null;
  demo_video_path: string | null;
};

export type Exercise = ExerciseInput & {
  id: string;
  is_bodyweight: boolean; // generated column — read-only
  verified: boolean; // moderation flag — toggled from the list, never via the form
  created_by: string | null;
  created_at: string;
};

/** State returned by the create/update Server Actions to `useActionState`. */
export type ExerciseFormState = {
  errors?: Record<string, string>;
  message?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split a textarea value into a trimmed, de-duplicated, order-preserving list. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const v = line.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function parseExerciseForm(formData: FormData): ExerciseInput {
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  const rawSlug = str("slug");
  return {
    name: str("name"),
    slug: rawSlug ? slugify(rawSlug) : slugify(str("name")),
    primary_muscle: str("primary_muscle"),
    secondary_muscles: parseList(formData.get("secondary_muscles") as string),
    equipment: parseList(formData.get("equipment") as string),
    cues: parseList(formData.get("cues") as string),
    common_mistakes: parseList(formData.get("common_mistakes") as string),
    demo_image_path: str("demo_image_path") || null,
    demo_video_path: str("demo_video_path") || null,
  };
}

export type ValidationResult =
  | { ok: true; value: ExerciseInput }
  | { ok: false; errors: Record<string, string> };

export function validateExerciseInput(input: ExerciseInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = "Name is required.";
  if (!input.slug) errors.slug = "Slug is required.";
  else if (!SLUG_RE.test(input.slug))
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens.";
  if (!input.primary_muscle)
    errors.primary_muscle = "Primary muscle is required.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}
