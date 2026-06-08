"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deletePlan,
  setPlanDefault,
  setPlanPublished,
  setPlanReviewStatus,
} from "@/app/admin/(panel)/plans/actions";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/admin/plans";

type Result = { ok: boolean; error?: string };

export function PlanLifecycle({
  id,
  isPublished,
  reviewStatus,
  isDefault,
}: {
  id: string;
  isPublished: boolean;
  reviewStatus: ReviewStatus;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim().toLowerCase() === "yes";

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else if (r.error) window.alert(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setPlanPublished(id, !isPublished))}
        className={
          isPublished
            ? "rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 disabled:opacity-50"
            : "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        }
      >
        {isPublished ? "Published — Unpublish" : "Publish"}
      </button>

      <select
        value={reviewStatus}
        disabled={pending}
        onChange={(e) =>
          run(() => setPlanReviewStatus(id, e.target.value as ReviewStatus))
        }
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-emerald-600 disabled:opacity-50"
      >
        {REVIEW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setPlanDefault(id, !isDefault))}
        title="Hand-picked starter shown in recommendations"
        className={
          isDefault
            ? "rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-300 disabled:opacity-50"
            : "rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
        }
      >
        {isDefault ? "★ Hand-picked — unset" : "Mark hand-picked"}
      </button>

      <button
        type="button"
        onClick={() => {
          setConfirm("");
          dialogRef.current?.showModal();
        }}
        className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setConfirm("")}
        className="m-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/70"
      >
        <h2 className="text-base font-semibold">Delete plan?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This permanently deletes the plan and its entire structure (weeks,
          days, blocks, exercises). Type{" "}
          <span className="font-mono text-zinc-200">yes</span> to confirm.
        </p>
        <input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder='Type "yes"'
          aria-label='Type "yes" to confirm deletion'
          className="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-700"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!armed || pending}
            onClick={() => {
              dialogRef.current?.close();
              start(async () => {
                await deletePlan(id);
              });
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete plan
          </button>
        </div>
      </dialog>
    </div>
  );
}
