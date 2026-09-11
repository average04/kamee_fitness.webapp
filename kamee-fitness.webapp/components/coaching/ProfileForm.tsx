"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveProfile } from "@/app/coaching/(hub)/actions";
import {
  profileFormStateFromRow,
  profileInputFromFormState,
  type ProfileFormState,
} from "@/lib/coaching/profile";
import {
  createAutosaveController,
  type AutosaveController,
  type SaveState,
} from "@/lib/coaching/autosave";
import type { CoachingProfileRow } from "@/lib/coaching/queries";
import { SaveIndicator } from "./SaveIndicator";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-leaf-600 disabled:opacity-60";

export function ProfileForm({
  profile,
  readOnly,
}: {
  profile: CoachingProfileRow;
  readOnly: boolean;
}) {
  const [form, setForm] = useState<ProfileFormState>(() => profileFormStateFromRow(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const controllerRef = useRef<AutosaveController<ProfileFormState> | null>(null);

  function controller(): AutosaveController<ProfileFormState> {
    if (!controllerRef.current) {
      controllerRef.current = createAutosaveController<ProfileFormState>({
        save: (input) =>
          new Promise((resolve) => {
            startTransition(async () => {
              resolve(await saveProfile(profileInputFromFormState(input)));
            });
          }),
        onStateChange: setSaveState,
        onResult: (result) => setErrors(result.errors ?? {}),
      });
    }
    return controllerRef.current;
  }

  useEffect(() => {
    return () => controllerRef.current?.dispose();
  }, []);

  function update<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (!readOnly) controller().update(next);
  }

  function updateAndSaveNow<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (!readOnly) controller().saveNow(next);
  }

  function saveNow() {
    if (!readOnly) controller().saveNow(form);
  }

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mist">Profile</h2>
        <SaveIndicator state={saveState} onRetry={saveNow} />
      </div>

      <Field label="Headline" error={errors.headline} hint={`${form.headline.length}/80`}>
        <input
          className={inputClass}
          maxLength={80}
          value={form.headline}
          disabled={readOnly}
          onChange={(e) => update("headline", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field
        label="About"
        error={errors.about}
        hint={`${form.about.length}/2000, at least 80`}
      >
        <textarea
          className={`${inputClass} min-h-32`}
          maxLength={2000}
          value={form.about}
          disabled={readOnly}
          onChange={(e) => update("about", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Specialties" error={errors.specialties} hint="Up to 8">
        <input
          className={inputClass}
          value={form.specialties}
          disabled={readOnly}
          onChange={(e) => update("specialties", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Years of experience" error={errors.yearsExperience}>
        <input
          type="number"
          min={0}
          max={60}
          className={inputClass}
          value={form.yearsExperience}
          disabled={readOnly}
          onChange={(e) => update("yearsExperience", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Languages" error={errors.languages}>
        <input
          className={inputClass}
          value={form.languages}
          disabled={readOnly}
          onChange={(e) => update("languages", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Location" error={errors.locationLabel}>
        <input
          className={inputClass}
          value={form.locationLabel}
          disabled={readOnly}
          onChange={(e) => update("locationLabel", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Instagram" error={errors.instagram}>
        <input
          className={inputClass}
          value={form.instagram}
          disabled={readOnly}
          onChange={(e) => update("instagram", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Website" error={errors.website} hint="Must start with https://">
        <input
          className={inputClass}
          value={form.website}
          disabled={readOnly}
          onChange={(e) => update("website", e.target.value)}
          onBlur={saveNow}
        />
      </Field>

      <Field label="Typical response time" error={errors.responseDays}>
        <select
          className={inputClass}
          value={form.responseDays}
          disabled={readOnly}
          onChange={(e) => updateAndSaveNow("responseDays", Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {d} day{d > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-mist">
        <input
          type="checkbox"
          checked={form.isAcceptingClients}
          disabled={readOnly}
          onChange={(e) => updateAndSaveNow("isAcceptingClients", e.target.checked)}
        />
        Currently accepting clients
      </label>

      <label className="flex items-center gap-2 text-sm text-mist">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          disabled={readOnly}
          onChange={(e) => updateAndSaveNow("termsAccepted", e.target.checked)}
        />
        I accept the{" "}
        <Link href="/terms" className="text-leaf-500 underline hover:text-leaf-400">
          coach terms
        </Link>
      </label>
    </div>
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
      <div className="flex items-center justify-between">
        <label className="block text-sm text-mist">{label}</label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
