"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSpecialty,
  customSpecialties,
  isSpecialtySelected,
  MAX_SPECIALTIES,
  MAX_SPECIALTY_LENGTH,
  toggleSpecialty,
} from "@/lib/coaching/specialties";
import { inputClass } from "./ui";

export function SpecialtySelector({
  value,
  options,
  optionsError,
  readOnly,
  error,
  onChange,
}: {
  value: string[];
  options: string[];
  optionsError: string | null;
  readOnly: boolean;
  error?: string;
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  // Draft text belongs to this editor, never to the autosaved profile state.
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const loading = !optionsError && options.length === 0;
  const disabled = readOnly || Boolean(optionsError) || loading;
  const atLimit = value.length >= MAX_SPECIALTIES;
  const custom = customSpecialties(value, options);
  const describedBy = [`${id}-hint`, error && `${id}-error`, optionsError && `${id}-options-error`]
    .filter(Boolean).join(" ");

  function change(next: string[]) {
    if (disabled) return;
    setDraftError(null);
    onChange(next);
  }

  function addCustom() {
    if (disabled) return;
    const result = addSpecialty(value, draft);
    if (!result.ok) {
      setDraftError(result.error);
      return;
    }
    change(result.value);
    setDraft("");
  }

  const choiceClass = "flex min-h-11 min-w-0 items-start gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-mist has-[:checked]:border-leaf-500/60 has-[:checked]:bg-leaf-500/10 has-[:disabled]:opacity-65";
  const checkboxClass = "mt-0.5 h-4 w-4 shrink-0 accent-leaf-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500";

  return (
    <div className="col-span-full min-w-0 space-y-3">
      <fieldset disabled={disabled} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="min-w-0 space-y-3">
        <legend className="text-sm font-medium text-mist">Specialties</legend>
        <p id={`${id}-hint`} aria-live="polite" className="text-xs text-muted">
          {value.length}/{MAX_SPECIALTIES} selected. {atLimit ? "Remove a specialty to add another." : "Choose presets or add your own."}
        </p>
        {loading && <p role="status" className="text-sm text-muted">Loading specialty options. Your saved specialties are shown below.</p>}
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const checked = isSpecialtySelected(value, option);
            return (
              <label key={option} className={choiceClass}>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={checked}
                  disabled={disabled || (atLimit && !checked)}
                  onChange={(event) => change(toggleSpecialty(value, option, event.target.checked))}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{option}</span>
              </label>
            );
          })}
        </div>
        {custom.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">{disabled && options.length === 0 ? "Saved specialties" : "Your custom specialties"}</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {custom.map(({ label, index }) => (
                <label key={index} className={choiceClass}>
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked
                    disabled={disabled}
                    onChange={() => change(value.filter((_, valueIndex) => valueIndex !== index))}
                  />
                  <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{label || "Unnamed specialty"}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="min-w-0 space-y-1.5">
          <label htmlFor={`${id}-custom`} className="block text-sm font-medium text-mist">Custom specialty</label>
          <p id={`${id}-custom-hint`} className="text-xs text-muted">Up to {MAX_SPECIALTY_LENGTH} characters. Select Add or press Enter to include it.</p>
          <div className="flex min-w-0 flex-wrap gap-2">
            <input
              id={`${id}-custom`}
              className={`${inputClass} min-w-0 flex-1 basis-40`}
              value={draft}
              maxLength={MAX_SPECIALTY_LENGTH}
              disabled={disabled || atLimit}
              aria-invalid={draftError ? true : undefined}
              aria-describedby={[`${id}-custom-hint`, draftError && `${id}-custom-error`].filter(Boolean).join(" ")}
              onChange={(event) => { setDraft(event.target.value); setDraftError(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addCustom();
                }
              }}
            />
            <button
              type="button"
              disabled={disabled || atLimit}
              onClick={addCustom}
              className="min-h-11 rounded-xl border border-leaf-500/60 px-4 py-2 text-sm font-semibold text-leaf-400 hover:bg-leaf-500/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500 disabled:opacity-50"
            >Add</button>
          </div>
          {draftError && <p id={`${id}-custom-error`} role="alert" className="text-sm text-red-400">{draftError}</p>}
        </div>
      </fieldset>
      {optionsError && (
        <div className="space-y-2">
          <p id={`${id}-options-error`} role="alert" className="text-sm text-red-400">{optionsError} Your saved specialties are preserved; you can still edit other profile details.</p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => startRetry(() => router.refresh())}
            className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm text-mist hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500 disabled:opacity-50"
          >{retrying ? "Retrying…" : "Retry specialty options"}</button>
        </div>
      )}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
