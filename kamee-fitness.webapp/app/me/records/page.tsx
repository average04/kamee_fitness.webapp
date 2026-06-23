import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { buildRecords, type RecordSet } from "@/lib/me/records";
import { buildTrackRecords } from "@/lib/me/trackRecords";
import BackLink from "@/components/me/BackLink";
import RecordsList from "@/components/me/RecordsList";
import TrackRecords from "@/components/me/TrackRecords";

export const metadata = { title: "Personal records" };

export default async function RecordsPage() {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const data = await loadMeData(supabase, user.id);
  const units = data.profile?.units ?? "metric";

  const dateBySession = new Map<string, string>();
  for (const w of data.workouts) {
    if (w.status === "completed") {
      dateBySession.set(w.id, w.started_at.slice(0, 10));
    }
  }
  const sets: RecordSet[] = [];
  for (const s of data.sets) {
    const dateIso = dateBySession.get(s.session_id);
    const exerciseId = s.plan_exercise_id
      ? data.exerciseIdByPlanEx[s.plan_exercise_id]
      : undefined;
    if (!dateIso || !exerciseId) continue;
    sets.push({
      exerciseId,
      name: data.nameByExercise[exerciseId] ?? "Exercise",
      dateIso,
      reps: s.reps_done ?? 0,
      weightKg: s.weight ?? 0,
    });
  }
  const records = buildRecords(sets).filter((r) => r.prKg > 0);
  const trackRecords = buildTrackRecords(data.tracks);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist">Records</h1>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-leaf-400">Lifting</h2>
        <div className="mt-3">
          {records.length ? (
            <RecordsList records={records} units={units} />
          ) : (
            <p className="text-sm text-muted">
              No lifting records yet — log a weighted set in the app to start.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-teal-500">Outdoor</h2>
        <div className="mt-3">
          <TrackRecords records={trackRecords} units={units} />
        </div>
      </section>
    </main>
  );
}
