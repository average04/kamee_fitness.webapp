"use client";

import { useActionState } from "react";
import type { Exercise, ExerciseFormState } from "@/lib/admin/exercises";
import { ArrayField } from "./ArrayField";
import { ImageUploadField } from "./ImageUploadField";

type Action = (
  state: ExerciseFormState,
  formData: FormData,
) => Promise<ExerciseFormState>;

export function ExerciseForm({
  action,
  exercise,
  muscles,
}: {
  action: Action;
  exercise?: Exercise;
  muscles: string[];
}) {
  const [state, formAction, pending] = useActionState<
    ExerciseFormState,
    FormData
  >(action, {});
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {exercise && <input type="hidden" name="id" value={exercise.id} />}

      <Field label="Name" error={err.name}>
        <input
          name="name"
          defaultValue={exercise?.name ?? ""}
          className={inputClass}
        />
      </Field>

      <Field
        label="Slug"
        error={err.slug}
        hint="Lowercase, hyphenated. Leave blank to derive from name."
      >
        <input
          name="slug"
          defaultValue={exercise?.slug ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Primary muscle" error={err.primary_muscle}>
        <input
          name="primary_muscle"
          list="muscle-options"
          defaultValue={exercise?.primary_muscle ?? ""}
          className={inputClass}
        />
        <datalist id="muscle-options">
          {muscles.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>

      {exercise && (
        <p className="text-xs text-zinc-500">
          Bodyweight:{" "}
          <span className="text-zinc-300">
            {exercise.is_bodyweight ? "yes" : "no"}
          </span>{" "}
          (auto — true when equipment is empty)
        </p>
      )}

      <ArrayField
        name="secondary_muscles"
        label="Secondary muscles"
        defaultValue={exercise?.secondary_muscles ?? []}
        placeholder="e.g. glutes"
      />
      <ArrayField
        name="equipment"
        label="Equipment"
        defaultValue={exercise?.equipment ?? []}
        placeholder="e.g. dumbbell (leave empty for bodyweight)"
      />
      <ArrayField
        name="cues"
        label="Cues"
        defaultValue={exercise?.cues ?? []}
        placeholder="e.g. brace your core"
      />
      <ArrayField
        name="common_mistakes"
        label="Common mistakes"
        defaultValue={exercise?.common_mistakes ?? []}
        placeholder="e.g. rounding the back"
      />

      <ImageUploadField currentPath={exercise?.demo_image_path ?? null} />

      <Field label="Demo video path" hint="Optional. Stored as text.">
        <input
          name="demo_video_path"
          defaultValue={exercise?.demo_video_path ?? ""}
          className={inputClass}
        />
      </Field>
      {/* Preserve the existing image path when no new file is chosen. */}
      <input
        type="hidden"
        name="demo_image_path"
        value={exercise?.demo_image_path ?? ""}
      />

      {state.message && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : exercise ? "Save changes" : "Create exercise"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
