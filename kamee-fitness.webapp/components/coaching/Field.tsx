"use client";

import { cloneElement, useId, type ReactElement } from "react";

/**
 * Shared a11y wrapper for a single labeled form control across the Coaching
 * Hub's forms (profile, credentials, gallery). Ties the label to its input
 * via `htmlFor`/`id`, and exposes the hint/error to assistive tech through
 * `aria-describedby` + `aria-invalid` instead of them being sighted-only
 * decoration next to an anonymous input (I7, fix round 1 on ProfileForm;
 * extracted here per R20 so CredentialsManager/GalleryManager reuse the
 * same pattern instead of re-deriving it).
 */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  // A permissive prop shape (rather than pinning the exact <input>/<textarea>/
  // <select> attributes union) so cloneElement below accepts whichever of
  // the three this Field wraps without fighting each intrinsic element's
  // own (wider) prop types -- e.g. aria-invalid is `Booleanish` on inputs,
  // not the narrower `boolean` we'd otherwise have to declare here.
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm text-mist">
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-xs text-muted">
            {hint}
          </span>
        )}
      </div>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
