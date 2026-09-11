"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
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

const inputClass =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-leaf-600 disabled:opacity-60";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    upsertCredential,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Server Actions driven by useActionState don't reset an uncontrolled
  // form on their own -- once a save actually lands, drop out of edit mode
  // so the form goes back to "add" defaults. Adjusted during render (the
  // React-recommended way to react to a prop/state change) rather than in
  // an effect, since an effect that only calls setState causes an extra
  // wasted render pass.
  const [savedAtSeen, setSavedAtSeen] = useState(state.savedAt);
  if (state.savedAt !== savedAtSeen) {
    setSavedAtSeen(state.savedAt);
    setEditing(null);
  }

  // The native form reset (an imperative DOM call, not React state) still
  // belongs in an effect.
  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  function startEdit(row: CredentialRow) {
    setEditing(row);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startAdd() {
    setEditing(null);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {credentials.length === 0 && (
          <p className="text-sm text-muted">No credentials yet.</p>
        )}
        {credentials.map((row) => (
          <CredentialRowView
            key={row.id}
            coachId={coachId}
            row={row}
            readOnly={readOnly}
            onEdit={() => startEdit(row)}
          />
        ))}
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
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

        <Field label="Title" error={state.errors?.title} hint="Up to 120 characters">
          <input
            className={inputClass}
            name="title"
            maxLength={120}
            defaultValue={editing?.title ?? ""}
            disabled={readOnly}
            required
          />
        </Field>

        <Field label="Issuer" error={state.errors?.issuer} hint="Up to 120 characters">
          <input
            className={inputClass}
            name="issuer"
            maxLength={120}
            defaultValue={editing?.issuer ?? ""}
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
            defaultValue={editing?.issued_year ?? ""}
            disabled={readOnly}
          />
        </Field>

        <Field label="Expires on" error={state.errors?.expiresOn} hint="YYYY-MM-DD">
          <input
            type="date"
            className={inputClass}
            name="expires_on"
            defaultValue={editing?.expires_on ?? ""}
            disabled={readOnly}
          />
        </Field>

        {editing?.is_verified && (
          <p className="text-xs text-amber-400">
            Verification will be reset when you save these changes.
          </p>
        )}

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
}: {
  coachId: string;
  row: CredentialRow;
  readOnly: boolean;
  onEdit: () => void;
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
    try {
      const supabase = createBrowserSupabase();
      const { data, error: signError } = await supabase.storage
        .from("coaching-documents")
        .createSignedUrl(row.document_path, 60);
      if (signError || !data?.signedUrl) {
        setError("Could not open the document. Please retry.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open the document. Please retry.");
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
      if (result.message) setError(result.message);
    } catch {
      setError("Could not delete. Please retry.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

        <label
          htmlFor={inputId}
          className={
            readOnly || uploading
              ? "pointer-events-none text-xs text-muted/50 underline"
              : "cursor-pointer text-xs text-leaf-500 underline hover:text-leaf-400"
          }
        >
          {uploading ? "Uploading…" : row.document_path ? "Replace document" : "Attach document"}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={readOnly || uploading}
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${className}`}>{children}</span>
  );
}
