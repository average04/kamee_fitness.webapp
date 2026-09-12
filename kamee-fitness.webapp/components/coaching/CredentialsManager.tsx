"use client";

import { useActionState, useId, useRef, useState } from "react";
import {
  deleteCredential,
  setCredentialDocument,
  upsertCredential,
} from "@/app/coaching/(hub)/actions";
import type { FormState } from "@/lib/coaching/profile";
import {
  checkDocumentFile,
  extensionForDocumentMimeType,
} from "@/lib/coaching/storage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Field } from "./Field";
import { inputClass, Pill } from "./ui";

export type CredentialRow = {
  id: string;
  title: string;
  issuer: string;
  issued_year: number | null;
  expires_on: string | null;
  document_path: string | null;
  is_verified: boolean;
  verified_at: string | null;
};

type CredentialFormValues = {
  title: string;
  issuer: string;
  issuedYear: string;
  expiresOn: string;
};

function valuesFromRow(row: CredentialRow | null): CredentialFormValues {
  return {
    title: row?.title ?? "",
    issuer: row?.issuer ?? "",
    issuedYear: row?.issued_year != null ? String(row.issued_year) : "",
    expiresOn: row?.expires_on ?? "",
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * I4 (fix round 1): wrap the Server Action itself so a rejected call (a
 * network failure, not just a FormState carrying `.message`) still
 * resolves to a friendly FormState instead of leaving useActionState's
 * `pending` stuck true forever / surfacing as an uncaught rejection (R20:
 * every client async path must be wrapped in try/catch).
 */
async function submitCredential(prev: FormState, formData: FormData): Promise<FormState> {
  try {
    return await upsertCredential(prev, formData);
  } catch {
    return { message: "Could not save the credential. Please retry." };
  }
}

export function CredentialsManager({
  coachId,
  credentials,
  readOnly,
}: {
  coachId: string;
  credentials: CredentialRow[];
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState<CredentialRow | null>(null);
  const [values, setValues] = useState<CredentialFormValues>(() => valuesFromRow(null));
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitCredential,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // I2 (fix round 1): the form's inputs are controlled (see below) so a
  // save landing -- whether it succeeds or comes back with field errors --
  // never wipes out or misattributes typed text. React 19 auto-resets an
  // uncontrolled <form>'s fields once its action settles regardless of
  // whether the result carries an error; a purely uncontrolled form would
  // silently discard the coach's just-typed (invalid) input the instant
  // the server responded with `{ errors }`. Only on an actual *save*
  // (state.savedAt changes) do we intentionally clear back to "add"
  // defaults, adjusted during render (the React-recommended way to react
  // to a state change) rather than in an effect that only calls setState.
  const [savedAtSeen, setSavedAtSeen] = useState(state.savedAt);
  if (state.savedAt !== savedAtSeen) {
    setSavedAtSeen(state.savedAt);
    setEditing(null);
    setValues(valuesFromRow(null));
  }

  function startEdit(row: CredentialRow) {
    setEditing(row);
    setValues(valuesFromRow(row));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startAdd() {
    setEditing(null);
    setValues(valuesFromRow(null));
  }

  // I2: deleting the row currently being edited must return the form to
  // "Add", not keep showing (and risk resubmitting) a now-gone row's id.
  function handleDeleted(id: string) {
    if (editing?.id === id) {
      setEditing(null);
      setValues(valuesFromRow(null));
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-3">
        {credentials.length === 0 && (
          <p className="text-sm text-muted">No credentials added.</p>
        )}
        {credentials.map((row) => (
          <CredentialRowView
            key={row.id}
            coachId={coachId}
            row={row}
            readOnly={readOnly}
            onEdit={() => startEdit(row)}
            onDeleted={() => handleDeleted(row.id)}
          />
        ))}
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 coach-panel"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mist">
            {editing ? "Edit credential" : "Add a credential"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={startAdd}
              className="text-xs text-muted underline hover:text-mist"
            >
              Cancel edit
            </button>
          )}
        </div>

        {editing && <input type="hidden" name="id" value={editing.id} />}

        {state.message && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}

        <div className="coach-credential-fields">
        <Field label="Title" error={state.errors?.title} hint="Up to 120 characters">
          <input
            className={inputClass}
            name="title"
            placeholder="e.g. Certified Personal Trainer"
            maxLength={120}
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            disabled={readOnly}
            required
          />
        </Field>

        <Field label="Issuer" error={state.errors?.issuer} hint="Up to 120 characters">
          <input
            className={inputClass}
            name="issuer"
            placeholder="Issuing organisation"
            maxLength={120}
            value={values.issuer}
            onChange={(e) => setValues((v) => ({ ...v, issuer: e.target.value }))}
            disabled={readOnly}
            required
          />
        </Field>

        <Field label="Issued year" error={state.errors?.issuedYear} hint="1950-2100">
          <input
            type="number"
            className={inputClass}
            name="issued_year"
            min={1950}
            max={2100}
            value={values.issuedYear}
            onChange={(e) => setValues((v) => ({ ...v, issuedYear: e.target.value }))}
            disabled={readOnly}
          />
        </Field>

        <Field label="Expires on" error={state.errors?.expiresOn} hint="YYYY-MM-DD">
          <input
            type="date"
            className={inputClass}
            name="expires_on"
            value={values.expiresOn}
            onChange={(e) => setValues((v) => ({ ...v, expiresOn: e.target.value }))}
            disabled={readOnly}
          />
        </Field>

        {editing?.is_verified && (
          <p className="text-xs text-amber-400">
            Verification will be reset when you save these changes.
          </p>
        )}

        </div>
        <button
          type="submit"
          disabled={readOnly || pending}
          className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Add credential"}
        </button>
      </form>
    </div>
  );
}

function CredentialRowView({
  coachId,
  row,
  readOnly,
  onEdit,
  onDeleted,
}: {
  coachId: string;
  row: CredentialRow;
  readOnly: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpired = row.expires_on !== null && row.expires_on < todayIso();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the native input immediately so re-selecting the same
    // (possibly rejected) file fires onChange again.
    if (inputRef.current) inputRef.current.value = "";
    if (!file || readOnly) return;

    const check = checkDocumentFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    const ext = extensionForDocumentMimeType(file.type);
    if (!ext) {
      setError("Please choose a PDF, JPEG, or PNG file.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const path = `${coachId}/${row.id}/${crypto.randomUUID()}.${ext}`;
      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from("coaching-documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) {
        setError("Could not upload the document. Please retry.");
        return;
      }
      const result = await setCredentialDocument(row.id, path);
      if (result.message) setError(result.message);
    } catch {
      setError("Could not upload the document. Please retry.");
    } finally {
      setUploading(false);
    }
  }

  async function onView() {
    if (!row.document_path) return;
    setError(null);
    setViewing(true);
    // Minor (fix round 1): open the tab synchronously, inside the click
    // handler, so browsers that block a post-await window.open() (most of
    // them) don't swallow this as a popup. Null the opener reference for
    // safety (equivalent to noopener) while keeping our own handle so we
    // can navigate it once the signed URL resolves; close it on failure
    // rather than leaving a blank tab behind.
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (win) win.opener = null;
    try {
      const supabase = createBrowserSupabase();
      const { data, error: signError } = await supabase.storage
        .from("coaching-documents")
        .createSignedUrl(row.document_path, 60);
      if (signError || !data?.signedUrl) {
        setError("Could not open the document. Please retry.");
        win?.close();
        return;
      }
      if (win) {
        win.location.href = data.signedUrl;
      } else {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Could not open the document. Please retry.");
      win?.close();
    } finally {
      setViewing(false);
    }
  }

  async function onDelete() {
    if (readOnly) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this credential?")) return;
    setError(null);
    setDeleting(true);
    try {
      const result = await deleteCredential(row.id);
      if (result.message) {
        setError(result.message);
        return;
      }
      onDeleted();
    } catch {
      setError("Could not delete. Please retry.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-ink-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-mist">{row.title}</p>
          <p className="text-xs text-muted">
            {row.issuer}
            {row.issued_year ? ` · ${row.issued_year}` : ""}
          </p>
          {row.expires_on && <p className="text-xs text-muted">Expires {row.expires_on}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.is_verified ? (
            <Pill className="border-leaf-600/40 text-leaf-400">Verified</Pill>
          ) : (
            <Pill className="border-white/10 text-muted">Pending review</Pill>
          )}
          {isExpired && <Pill className="border-amber-500/40 text-amber-400">Expired</Pill>}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={readOnly}
          className="text-xs text-leaf-500 hover:text-leaf-400 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={readOnly || deleting}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>

        {row.document_path && (
          <button
            type="button"
            onClick={onView}
            disabled={viewing}
            className="text-xs text-muted underline hover:text-mist disabled:opacity-50"
          >
            {viewing ? "Opening…" : "Document attached · view"}
          </button>
        )}

        {/*
          I3 (fix round 1): the file input is `sr-only` (present, focusable,
          and keyboard-operable -- Space opens the OS file dialog on a
          focused <input type=file>) rather than `hidden` (removed from the
          tab order entirely). It's rendered BEFORE the label so the
          label's `peer-focus-visible:*` classes can react to the input's
          own focus state and give keyboard users a visible focus ring.
        */}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="peer sr-only"
          disabled={readOnly || uploading}
          onChange={onFileChange}
        />
        <label
          htmlFor={inputId}
          className={
            (readOnly || uploading
              ? "pointer-events-none text-xs text-muted/50 underline"
              : "cursor-pointer text-xs text-leaf-500 underline hover:text-leaf-400") +
            " rounded peer-focus-visible:ring-2 peer-focus-visible:ring-leaf-600 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-950"
          }
        >
          {uploading ? "Uploading…" : row.document_path ? "Replace document" : "Attach document"}
        </label>
      </div>
    </div>
  );
}
