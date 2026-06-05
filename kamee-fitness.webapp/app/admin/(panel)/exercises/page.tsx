import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseTable } from "@/components/admin/ExerciseTable";
import { listExercises } from "./queries";
import { setDemoVideo } from "./actions";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const { rows, count, pageCount } = await listExercises(q.trim(), pageNum);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Exercises <span className="text-zinc-500">({count})</span>
        </h1>
        <Link
          href="/admin/exercises/new"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          New exercise
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, slug, or muscle…"
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm">
          Search
        </button>
      </form>

      <ExerciseTable rows={rows} onSaveVideo={setDemoVideo} />

      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          {pageNum > 1 && (
            <Link
              href={`/admin/exercises?q=${encodeURIComponent(q)}&page=${pageNum - 1}`}
              className="hover:text-zinc-100"
            >
              ← Prev
            </Link>
          )}
          <span>
            Page {pageNum} of {pageCount}
          </span>
          {pageNum < pageCount && (
            <Link
              href={`/admin/exercises?q=${encodeURIComponent(q)}&page=${pageNum + 1}`}
              className="hover:text-zinc-100"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
