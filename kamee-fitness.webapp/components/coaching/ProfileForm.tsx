"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { Field } from "./Field";
import { SaveIndicator } from "./SaveIndicator";
import { inputClass } from "./ui";

export function ProfileForm({
  profile,
  readOnly,
}: {
  profile: CoachingProfileRow;
  readOnly: boolean;
}) {
  const [form, setForm] = useState<ProfileFormState>(() => profileFormStateFromRow(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const controllerRef = useRef<AutosaveController<ProfileFormState> | null>(null);

  function controller(): AutosaveController<ProfileFormState> {
    if (!controllerRef.current) {
      controllerRef.current = createAutosaveController<ProfileFormState>({
        // C1 (fix round 1): call the Server Action directly and let its
        // real promise (resolve OR reject) reach the autosave controller.
        // The previous `startTransition(async () => resolve(await ...))`
        // wrapper never settled the outer Promise when saveProfile
        // rejected, which wedged `inFlight` true forever and could surface
        // as an uncaught rejection. `isPending` was never read, so the
        // transition bought nothing.
        save: (input) => saveProfile(profileInputFromFormState(input)),
        onStateChange: setSaveState,
        // M11 (fix round 2): surface result.message (e.g. the "paused while
        // in review" copy from guardEditable) next to the SaveIndicator,
        // not just field-level errors.
        onResult: (result) => {
          setErrors(result.errors ?? {});
          setMessage(result.message ?? null);
        },
      });
    }
    return controllerRef.current;
  }

  useEffect(() => {
    return () => controllerRef.current?.dispose();
  }, []);

  // I6 (fix round 2): read the autosave controller's own hasPending() --
  // true iff a debounce timer is pending, a save is in flight, or one is
  // queued -- instead of a parallel React flag, which drifted out of sync
  // with the controller (never set while only a timer was pending, cleared
  // on "saved" before a queued follow-up save had actually finished, and
  // never cleared when M10's equality check skipped a save outright). The
  // listener is attached once; it reads the controller fresh on every
  // unload attempt rather than closing over a stale flag.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!controllerRef.current?.hasPending()) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
      {message && (
        <p role="alert" className="text-sm text-red-400">
          {message}
        </p>
      )}

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
