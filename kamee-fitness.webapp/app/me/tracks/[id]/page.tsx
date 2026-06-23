import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadTrackDetail, loadUnits } from "@/lib/me/queries";
import { computeSplits, summarizeTrackDetail } from "@/lib/me/trackDetail";
import { fmtDistance, fmtDuration, fmtPaceFromMeters } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import RouteMap from "@/components/me/RouteMap";
import SplitBars from "@/components/me/SplitBars";
import StatGrid from "@/components/me/StatGrid";

export const metadata = { title: "Track" };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [res, units] = await Promise.all([
    loadTrackDetail(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
  if (!res) notFound();
  const { track, previous } = res;
  const distanceM = track.distance_meters ?? 0;
  const durationS = track.duration_seconds ?? 0;
  const unitMeters = units === "imperial" ? 1609.344 : 1000;
  const splits = computeSplits(track.route_points, unitMeters);
  const summary = summarizeTrackDetail({ distanceM, durationS }, previous);

  const paceDelta = summary.paceDeltaSecPerKm;
  const paceDeltaLabel =
    paceDelta == null
      ? null
      : paceDelta === 0
        ? "same pace as last"
        : `${Math.abs(Math.round(paceDelta))}s/km ${paceDelta < 0 ? "faster" : "slower"} vs last`;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4 border-b border-white/8 pb-6">
        <h1 className="font-display text-2xl font-bold text-mist">
          {cap(track.mode)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {(track.finished_at ?? track.created_at).slice(0, 10)}
        </p>
        <div className="mt-4">
          <StatGrid
            cells={[
              { label: "Distance", value: fmtDistance(distanceM, units) },
              { label: "Duration", value: fmtDuration(durationS) },
              {
                label: "Avg pace",
                value: fmtPaceFromMeters(distanceM, durationS, units),
              },
              { label: "Avg HR", value: track.avg_hr ? `♥ ${track.avg_hr}` : "—" },
              { label: "Max HR", value: track.max_hr ? `♥ ${track.max_hr}` : "—" },
              {
                label: "Elev ↑/↓",
                value: `${Math.round(track.elevation_gain_meters ?? 0)}/${Math.round(track.elevation_loss_meters ?? 0)}m`,
              },
            ]}
          />
        </div>
        {paceDeltaLabel && (
          <p
            className={
              "mt-2 text-sm " +
              (paceDelta != null && paceDelta < 0
                ? "text-leaf-400"
                : "text-ember-400")
            }
          >
            {paceDeltaLabel}
          </p>
        )}
      </header>
      <div className="mt-6">
        <RouteMap routePoints={track.route_points} />
      </div>
      {splits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted">Splits</h2>
          <div className="mt-3">
            <SplitBars splits={splits} units={units} />
          </div>
        </section>
      )}
    </main>
  );
}
