import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { buildRecords, type RecordSet } from "@/lib/me/records";
import BackLink from "@/components/me/BackLink";
import RecordsList from "@/components/me/RecordsList";

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

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist">
        Personal records
      </h1>
      <div className="mt-6">
        {records.length ? (
          <RecordsList records={records} units={units} />
        ) : (
          <p className="text-sm text-muted">
            No lifting records yet — log a weighted set in the app to start.
          </p>
        )}
      </div>
    </main>
  );
}
