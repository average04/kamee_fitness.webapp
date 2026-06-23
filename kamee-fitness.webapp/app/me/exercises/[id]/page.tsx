import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  exerciseDemoUrl,
  loadExerciseHistory,
  loadUnits,
} from "@/lib/me/queries";
import { buildExerciseHistory } from "@/lib/me/exerciseHistory";
import { fmtVolume, fmtWeight } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import ExerciseProgressionChart from "@/components/me/ExerciseProgressionChart";

export const metadata = { title: "Exercise" };

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [hist, units] = await Promise.all([
    loadExerciseHistory(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
  if (!hist) notFound();
  const h = buildExerciseHistory(hist.sets);
  const chart = h.series.map((s) => ({
    dateIso: s.dateIso,
    topSetKg: Math.round(s.topSetKg),
    est1RmKg: Math.round(s.bestEst1RmKg),
  }));
  const bestEst1Rm = h.series.reduce((m, s) => Math.max(m, s.bestEst1RmKg), 0);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4">
        <h1 className="font-display text-2xl font-bold text-mist">{hist.name}</h1>
        {hist.primaryMuscle && (
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-teal-500">
            {hist.primaryMuscle}
          </p>
        )}
        {hist.demoImagePath && (
          <Image
            src={exerciseDemoUrl(hist.demoImagePath)}
            alt={hist.name}
            width={320}
            height={320}
            className="mt-4 size-40 rounded-2xl border border-white/8 object-cover"
          />
        )}
        {h.timesTrained > 0 ? (
          <p className="mt-4 text-sm text-muted">
            PR {fmtWeight(h.prKg, units)}
            {h.prDateIso ? ` (${h.prDateIso})` : ""} · est 1RM{" "}
            {fmtWeight(bestEst1Rm, units)} · last {fmtWeight(h.lastWeightKg, units)}{" "}
            · best vol {fmtVolume(h.bestVolumeKg, units)} · trained{" "}
            {h.timesTrained}×
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No sets logged yet.</p>
        )}
      </header>
      {chart.length > 1 && (
        <div className="mt-6">
          <ExerciseProgressionChart data={chart} />
        </div>
      )}
      {chart.length > 0 && (
        <ul className="mt-6 space-y-1 text-sm text-mist/85">
          {[...h.series].reverse().map((s) => (
            <li key={s.dateIso} className="flex justify-between gap-3">
              <span className="text-muted">{s.dateIso}</span>
              <span>top {fmtWeight(s.topSetKg, units)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
