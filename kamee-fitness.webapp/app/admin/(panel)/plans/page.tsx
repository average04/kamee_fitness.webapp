import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PLAN_KINDS, REVIEW_STATUSES } from "@/lib/admin/plans";
import { PlanTable } from "@/components/admin/plans/PlanTable";
import { listPlans, type PlanFilters } from "./queries";

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  kind?: string;
  status?: string;
  published?: string;
  page?: string;
};

const labelCls = "text-xs text-zinc-500";
const ctrlCls =
  "rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const filters: PlanFilters = {
    q: (sp.q ?? "").trim(),
    kind: (PLAN_KINDS as readonly string[]).includes(sp.kind ?? "")
      ? (sp.kind as PlanFilters["kind"])
      : "all",
    status: (REVIEW_STATUSES as readonly string[]).includes(sp.status ?? "")
      ? (sp.status as PlanFilters["status"])
      : "all",
    published:
      sp.published === "yes" || sp.published === "no" ? sp.published : "all",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, count, pageCount } = await listPlans(filters, page);

  const qs = (over: Partial<SP>) => {
    const merged: SP = {
      q: filters.q || undefined,
      kind: filters.kind === "all" ? undefined : filters.kind,
      status: filters.status === "all" ? undefined : filters.status,
      published: filters.published === "all" ? undefined : filters.published,
      ...over,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/admin/plans?${s}` : "/admin/plans";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Plans <span className="text-zinc-500">({count})</span>
        </h1>
        <Link
          href="/admin/plans/new"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          New plan
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Search</span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Title…"
            className={`${ctrlCls} w-56`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Kind</span>
          <select name="kind" defaultValue={filters.kind} className={ctrlCls}>
            <option value="all">All</option>
            {PLAN_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Review</span>
          <select name="status" defaultValue={filters.status} className={ctrlCls}>
            <option value="all">All</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Published</span>
          <select
            name="published"
            defaultValue={filters.published}
            className={ctrlCls}
          >
            <option value="all">All</option>
            <option value="yes">Published</option>
            <option value="no">Draft</option>
          </select>
        </div>
        <button className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm">
          Apply
        </button>
        <Link
          href="/admin/plans"
          className="px-1 py-1.5 text-sm text-zinc-500 hover:text-zinc-300"
        >
          Reset
        </Link>
      </form>

      <PlanTable rows={rows} />

      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          {page > 1 && (
            <Link href={qs({ page: String(page - 1) })} className="hover:text-zinc-100">
              ← Prev
            </Link>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={qs({ page: String(page + 1) })} className="hover:text-zinc-100">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
