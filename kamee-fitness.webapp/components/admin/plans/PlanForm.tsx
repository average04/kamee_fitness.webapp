"use client";

import { useActionState } from "react";
import {
  EQUIPMENT_TIERS,
  EXPERIENCE_LEVELS,
  PLAN_KINDS,
  type Plan,
  type PlanFormState,
} from "@/lib/admin/plans";
import { ArrayField } from "@/components/admin/ArrayField";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type Action = (
  state: PlanFormState,
  formData: FormData,
) => Promise<PlanFormState>;

export function PlanForm({ action, plan }: { action: Action; plan?: Plan }) {
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(
    action,
    {},
  );
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {plan && <input type="hidden" name="id" value={plan.id} />}

      <Field label="Title" error={err.title}>
        <input name="title" defaultValue={plan?.title ?? ""} className={input} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" error={err.kind}>
          <Select name="kind" options={PLAN_KINDS} value={plan?.kind ?? "system"} />
        </Field>
        <Field label="Level" error={err.level}>
          <Select
            name="level"
            options={EXPERIENCE_LEVELS}
            value={plan?.level ?? "beginner"}
          />
        </Field>
      </div>

      <Field label="Summary">
        <textarea
          name="summary"
          rows={3}
          defaultValue={plan?.summary ?? ""}
          className={input}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Goal" hint="Free text, e.g. build strength">
          <input name="goal" defaultValue={plan?.goal ?? ""} className={input} />
        </Field>
        <Field label="Equipment tier" error={err.equipment_tier}>
          <Select
            name="equipment_tier"
            options={EQUIPMENT_TIERS}
            value={plan?.equipment_tier ?? "bodyweight"}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Weeks" error={err.weeks_count} hint="1–52">
          <input
            type="number"
            name="weeks_count"
            min={1}
            max={52}
            defaultValue={plan?.weeks_count ?? 4}
            className={input}
          />
        </Field>
        <Field label="Est. minutes / session">
          <input
            type="number"
            name="est_minutes_per_session"
            min={0}
            defaultValue={plan?.est_minutes_per_session ?? ""}
            className={input}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Price (cents)"
          error={err.price_cents}
          hint="0 = free · 999 = $9.99"
        >
          <input
            type="number"
            name="price_cents"
            min={0}
            defaultValue={plan?.price_cents ?? 0}
            className={input}
          />
        </Field>
        <Field label="Currency">
          <input
            name="currency"
            defaultValue={plan?.currency ?? "USD"}
            className={input}
          />
        </Field>
      </div>

      <ArrayField
        name="required_equipment"
        label="Required equipment"
        defaultValue={plan?.required_equipment ?? []}
        placeholder="e.g. dumbbell"
      />
      <ArrayField
        name="target_muscles"
        label="Target muscles"
        defaultValue={plan?.target_muscles ?? []}
        placeholder="e.g. full_body"
      />

      <ImageUploadField
        label="Cover image"
        currentPath={plan?.cover_image_path ?? null}
      />
      <input
        type="hidden"
        name="cover_image_path"
        value={plan?.cover_image_path ?? ""}
      />

      {state.message && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : plan ? "Save changes" : "Create plan"}
      </button>
    </form>
  );
}

const input =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600";

function Select({
  name,
  options,
  value,
}: {
  name: string;
  options: readonly string[];
  value: string;
}) {
  return (
    <select name={name} defaultValue={value} className={input}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

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
