import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { StoreBadge } from "@/components/landing/StoreBadges";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";
import {
  DISCIPLINE_LABELS,
  PLAN_COLUMNS,
  planAppUrl,
  planCoverUrl,
  type PlanRow,
} from "@/lib/public-plans";
import { createSupabaseServerClient } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEVEL_LABELS: Record<NonNullable<PlanRow["level"]>, string | null> = {
  none: null,
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * Public read of one published + approved plan. The UUID guard keeps garbage
 * ids from erroring in Postgres; anon RLS enforces the same visibility filter
 * as a second net. `cache()` dedupes the metadata + page fetches.
 */
const getPlan = cache(async (id: string): Promise<PlanRow | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("plans")
      .select(PLAN_COLUMNS)
      .eq("id", id)
      .eq("is_published", true)
      .eq("review_status", "approved")
      .maybeSingle();
    if (error) {
      console.error("plan page: query failed:", error.message);
      return null;
    }
    return (data as PlanRow | null) ?? null;
  } catch (err) {
    console.error("plan page: unexpected failure:", err);
    return null;
  }
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return { title: "Plan not found" };

  const description =
    plan.summary ??
    `A ${plan.weeks_count}-week ${DISCIPLINE_LABELS[plan.discipline].toLowerCase()} plan in the Kamee Fitness app.`;
  // Fall back to the site icon so coverless plans still unfurl with an image.
  // Next merges metadata shallowly per key, so openGraph/twitter must be
  // restated in full here — a partial object would drop the layout's fields.
  const images = [planCoverUrl(plan.cover_image_path) ?? "/adaptive-icon.png"];

  return {
    title: plan.title,
    description,
    alternates: { canonical: `/plans/${plan.id}` },
    openGraph: {
      title: plan.title,
      description,
      url: `/plans/${plan.id}`,
      siteName: "Kamee Fitness",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: plan.title,
      description,
      images,
    },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="font-display mt-1 text-sm font-semibold text-mist">
        {value}
      </p>
    </li>
  );
}

export default async function PlanPage({ params }: Props) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  const coverUrl = planCoverUrl(plan.cover_image_path);
  const levelLabel = plan.level ? LEVEL_LABELS[plan.level] : null;
  const stats: Array<{ label: string; value: string }> = [
    { label: "Length", value: `${plan.weeks_count} weeks` },
    ...(plan.days_per_week !== null
      ? [{ label: "Schedule", value: `${plan.days_per_week} days / week` }]
      : []),
    ...(plan.est_minutes_per_session !== null
      ? [
          {
            label: "Session",
            value: `~${plan.est_minutes_per_session} min`,
          },
        ]
      : []),
    ...(levelLabel ? [{ label: "Level", value: levelLabel }] : []),
  ];

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-leaf-400"
        >
          ← Kamee Fitness
        </Link>

        {coverUrl && (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-3xl border border-white/10">
            <Image
              src={coverUrl}
              alt={`${plan.title} cover`}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        )}

        <p className="mt-8">
          <span className="rounded-full border border-leaf-500/40 bg-leaf-500/[0.07] px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-300">
            {DISCIPLINE_LABELS[plan.discipline]}
          </span>
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold text-leaf-300 lg:text-5xl">
          {plan.title}
        </h1>
        {plan.summary && (
          <p className="mt-4 max-w-2xl text-ink-300">{plan.summary}</p>
        )}

        <ul className="mt-8 flex flex-wrap gap-3">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </ul>

        <div className="mt-10 border-t border-white/10 pt-8">
          <a
            href={planAppUrl(plan.id)}
            className="font-display inline-flex items-center gap-2 rounded-full bg-leaf-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-leaf-400"
          >
            Open in the Kamee app
          </a>
          <p className="mt-6 text-sm text-ink-400">
            Don&apos;t have the app yet?
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StoreBadge platform="ios" href={APP_STORE_URL} />
            <StoreBadge
              platform="android"
              href={PLAY_STORE_URL}
              eyebrow="Early access"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
