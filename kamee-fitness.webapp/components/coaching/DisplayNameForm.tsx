"use client";

import { useEffect, useState, useTransition } from "react";
import { saveDisplayName } from "@/app/coaching/(hub)/actions";
import { Field } from "./Field";
import { inputClass } from "./ui";

export function DisplayNameForm({ current, readOnly }: { current: string | null; readOnly: boolean }) {
  const [name, setName] = useState(current ?? "");
  const [savedName, setSavedName] = useState(current ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== savedName.trim();

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.href === location.href || link.getAttribute("href")?.startsWith("#")) return;
      if (!confirm("Leave without saving your display name?")) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);

  return <form className="coach-panel space-y-3" onSubmit={event => {
    event.preventDefault();
    if (readOnly || pending) return;
    const value = name.trim();
    setError(null); setMessage(null);
    start(async () => {
      try {
        const result = await saveDisplayName(value);
        if (result.message) { setError(result.message); return; }
        setName(value); setSavedName(value); setMessage("Name saved.");
      } catch { setError("Could not save your name. Please retry."); }
    });
  }}>
    <h2 className="text-sm font-semibold text-mist">Your name</h2>
    <p className="coach-panel-description">The name members see on your coach profile. This also updates your name in the Kamee app.</p>
    <Field label="Display name" required hint="Up to 120 characters" error={error ?? undefined}>
      <input className={inputClass} autoComplete="name" required maxLength={120} value={name} disabled={readOnly || pending}
        onChange={event => { setName(event.target.value); setMessage(null); setError(null); }} />
    </Field>
    <button type="submit" className="coach-primary" disabled={readOnly || pending || !dirty || !name.trim()}>
      {pending ? "Saving name…" : "Save name"}
    </button>
    <p role="status" className="text-sm text-muted">
      {readOnly ? "Your profile is in review, so name changes are paused." : pending ? "Saving your name…" : dirty ? "Name has unsaved changes. Save before continuing." : message}
    </p>
  </form>;
}
