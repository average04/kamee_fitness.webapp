import Link from "next/link";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { parseRange, resolveWindow } from "@/lib/me/range";
import { summarizeWorkouts } from "@/lib/me/workouts";
import { summarizeTracks } from "@/lib/me/tracks";
import { buildHeatmap } from "@/lib/me/heatmap";
import { buildWeightSeries } from "@/lib/me/weight";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtVolume,
  fmtWeight,
} from "@/lib/me/units";
import MeHeader from "@/components/me/MeHeader";
import StatCard from "@/components/me/StatCard";
import EmptyState from "@/components/me/EmptyState";
import ActivityHeatmap from "@/components/me/ActivityHeatmap";
import TrackList from "@/components/me/TrackList";
import WorkoutsPerWeekChart from "@/components/me/WorkoutsPerWeekChart";
import DistancePerWeekChart from "@/components/me/DistancePerWeekChart";
import WeightChart from "@/components/me/WeightChart";

export const metadata = { title: "Your stats" };

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const data = await loadMeData(supabase, user.id);
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const now = new Date();
  const dateWindow = resolveWindow(range, now, sp.from, sp.to);

  const units = data.profile?.units ?? "metric";
  const name = data.profile?.display_name ?? user.email?.split("@")[0] ?? "You";
  const isPremium = Boolean(data.profile?.is_premium);

  const w = summarizeWorkouts(
    data.workouts,
    data.sets,
    data.exerciseNames,
    data.streaks,
    dateWindow,
  );
  const t = summarizeTracks(data.tracks, data.streaks, dateWindow);
  const heat = buildHeatmap(data.workouts, data.tracks, 26, now);
  const weight = buildWeightSeries(data.weights, data.profile);

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      <MeHeader
        name={name}
        avatarUrl={data.profile?.avatar_url ?? null}
        isPremium={isPremium}
        range={range}
        from={sp.from}
        to={sp.to}
      />

      {/* Activity */}
      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Activity
        </h2>
        <div className="mt-4">
          <ActivityHeatmap days={heat.days} maxCount={heat.maxCount} />
        </div>
      </section>

      {/* Workouts */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-leaf-400">Workouts</h2>
        {w.sessions === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No completed workouts in this range yet."
              hint="Start a session in the Kamee app to see your stats here."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Sessions" value={String(w.sessions)} accent="leaf" />
              <StatCard
                label="Streak"
                value={`${w.currentStreak}`}
                sub={`best ${w.longestStreak}`}
                accent="sun"
              />
              <StatCard
                label="Volume"
                value={fmtVolume(w.totalVolumeKg, units)}
                accent="leaf"
              />
              <StatCard
                label="Time trained"
                value={fmtDuration(w.timeTrainedSeconds)}
              />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                  Workouts / week
                </h3>
                <div className="mt-2">
                  <WorkoutsPerWeekChart data={w.perWeek} />
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                    Top exercises
                  </h3>
                  {w.topExercises.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-mist/85">
                      {w.topExercises.map((e) => (
                        <li key={e.name} className="flex justify-between gap-3">
                          <span>{e.name}</span>
                          <span className="text-muted">{e.sets} sets</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted/70">No set data yet.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                    Personal records
                  </h3>
                  {w.prs.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-mist/85">
                      {w.prs.map((p) => (
                        <li key={p.name} className="flex justify-between gap-3">
                          <span>{p.name}</span>
                          <span className="text-leaf-400">
                            {fmtWeight(p.weightKg, units)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted/70">No PRs yet.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Tracks */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-teal-500">
          Outdoor tracks
        </h2>
        {t.count === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No tracks in this range yet."
              hint="Walk, run, or cycle with Kamee to fill this in."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Distance"
                value={fmtDistance(t.totalDistanceM, units)}
                accent="teal"
              />
              <StatCard label="Sessions" value={String(t.count)} accent="teal" />
              <StatCard
                label="Avg pace"
                value={fmtPaceFromMeters(t.totalDistanceM, t.totalDurationS, units)}
              />
              <StatCard
                label="Track streak"
                value={`${t.currentStreak}`}
                sub={`best ${t.longestStreak}`}
                accent="sun"
              />
            </div>
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                Distance / week
              </h3>
              <div className="mt-2">
                <DistancePerWeekChart
                  data={t.perWeek.map((p) => ({
                    week: p.week,
                    km: Math.round((p.distanceM / 1000) * 10) / 10,
                  }))}
                />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                Recent routes
              </h3>
              <div className="mt-2">
                <TrackList recent={t.recent} units={units} />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Weight */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-mist">
          Weight &amp; body
        </h2>
        {weight.points.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No weight logged yet."
              hint="Log your weight in the app to track it here."
            />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="font-display text-3xl font-bold text-mist">
                {weight.currentKg != null
                  ? fmtWeight(weight.currentKg, units)
                  : "—"}
              </div>
              {weight.targetKg != null && (
                <div className="text-sm text-muted">
                  goal {fmtWeight(weight.targetKg, units)}
                  {weight.toGoKg != null && (
                    <span className="text-ember-400">
                      {" · "}
                      {fmtWeight(Math.abs(weight.toGoKg), units)} to go
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3">
              <WeightChart data={weight.points} targetKg={weight.targetKg} />
            </div>
          </div>
        )}
      </section>

      <footer className="mt-16 border-t border-white/8 pt-6 text-xs text-muted">
        Read-only — logging happens in the Kamee app.{" "}
        <Link href="/" className="hover:text-white">
          Back to home
        </Link>
      </footer>
    </main>
  );
}
