import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadUnits, loadWorkoutDetail } from "@/lib/me/queries";
import { summarizeWorkoutDetail } from "@/lib/me/workoutDetail";
import { fmtDuration, fmtVolume } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import DeltaBadge from "@/components/me/DeltaBadge";
import ExerciseSetTable from "@/components/me/ExerciseSetTable";
import StatGrid from "@/components/me/StatGrid";

export const metadata = { title: "Workout" };

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [detail, units] = await Promise.all([
    loadWorkoutDetail(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
  if (!detail) notFound();

  const summary = summarizeWorkoutDetail(
    detail.current,
    detail.previous,
    detail.names,
    detail.priorMax,
    detail.muscleByExercise,
  );
  const startedAt = new Date(detail.session.startedAt);
  const timeOfDay = startedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4 border-b border-white/8 pb-6">
        <h1 className="font-display text-2xl font-bold text-mist">
          {detail.dayTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {detail.session.startedAt.slice(0, 10)}
          {detail.ratingLabel ? ` · ${detail.ratingLabel}` : ""}
        </p>
        <div className="mt-4">
          <StatGrid
            cells={[
              { label: "Sets", value: String(summary.totalSets) },
              { label: "Reps", value: String(summary.totalReps) },
              {
                label: "Duration",
                value: detail.session.durationSeconds
                  ? fmtDuration(detail.session.durationSeconds)
                  : "—",
              },
              {
                label: "Avg HR",
                value: detail.session.avgHr ? `♥ ${detail.session.avgHr}` : "—",
              },
              {
                label: "Max HR",
                value: detail.session.maxHr ? `♥ ${detail.session.maxHr}` : "—",
              },
              { label: "Time", value: timeOfDay },
            ]}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-display text-xl font-bold text-leaf-400">
            {fmtVolume(summary.totalVolumeKg, units)}
          </span>
          <DeltaBadge
            delta={summary.totalVolumeDeltaKg}
            format={(n) => fmtVolume(n, units)}
          />
          <span className="text-xs text-muted">total volume vs last time</span>
        </div>
      </header>
      <div className="mt-6">
        {summary.exercises.length ? (
          <ExerciseSetTable summary={summary} units={units} />
        ) : (
          <p className="text-sm text-muted">No sets logged for this session.</p>
        )}
      </div>
    </main>
  );
}
