import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { PlanLifecycle } from "@/components/admin/plans/PlanLifecycle";
import { PlanBuilder } from "@/components/admin/plans/builder/PlanBuilder";
import { getPlan, getPlanTree, listExerciseOptions } from "../queries";

export const dynamic = "force-dynamic";

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const coverUrl = (path: string | null) =>
  path && base ? `${base}/storage/v1/object/public/${path}` : null;
const price = (cents: number, currency: string) =>
  cents === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        cents / 100,
      );

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  const [weeks, exerciseOptions] = await Promise.all([
    getPlanTree(id),
    listExerciseOptions(),
  ]);

  const cover = coverUrl(plan.cover_image_path);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/plans" className="hover:text-zinc-300">
          Plans
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{plan.title}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="h-20 w-20 rounded-xl border border-zinc-800 object-cover"
            />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold">{plan.title}</h1>
            {plan.summary && (
              <p className="mt-1 max-w-xl text-sm text-zinc-400">{plan.summary}</p>
            )}
          </div>
        </div>
        <Link
          href={`/admin/plans/${plan.id}/edit`}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600"
        >
          Edit details
        </Link>
      </div>

      <PlanLifecycle
        id={plan.id}
        isPublished={plan.is_published}
        reviewStatus={plan.review_status}
        isDefault={plan.is_default}
      />

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-3 md:grid-cols-4">
        <Meta label="Kind" value={plan.kind} />
        <Meta label="Level" value={plan.level} />
        <Meta label="Weeks" value={String(plan.weeks_count)} />
        <Meta
          label="Equipment"
          value={plan.equipment_tier.replace(/_/g, " ")}
        />
        <Meta label="Price" value={price(plan.price_cents, plan.currency)} />
        <Meta
          label="Est. session"
          value={
            plan.est_minutes_per_session
              ? `${plan.est_minutes_per_session} min`
              : "—"
          }
        />
        <Meta label="Goal" value={plan.goal || "—"} />
        <Meta
          label="Target muscles"
          value={plan.target_muscles.length ? plan.target_muscles.join(", ") : "—"}
        />
      </dl>

      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Structure</h2>
        <PlanBuilder planId={plan.id} weeks={weeks} options={exerciseOptions} />
      </div>
    </div>
  );
}
