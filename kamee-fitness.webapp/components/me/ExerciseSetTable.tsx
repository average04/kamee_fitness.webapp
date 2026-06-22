import Link from "next/link";
import type { WorkoutDetailSummary } from "@/lib/me/workoutDetail";
import { fmtVolume, fmtWeight, type Units } from "@/lib/me/units";
import DeltaBadge from "./DeltaBadge";

export default function ExerciseSetTable({
  summary,
  units,
}: {
  summary: WorkoutDetailSummary;
  units: Units;
}) {
  return (
    <div className="space-y-3">
      {summary.exercises.map((e) => (
        <Link
          key={e.exerciseId}
          href={`/me/exercises/${e.exerciseId}`}
          className="block rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-leaf-500/30"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-display font-semibold text-mist">
              {e.name}
              {e.isPr && (
                <span className="ml-2 text-sun-500" title="Personal record">
                  ★ PR
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-leaf-400">{fmtWeight(e.topSetKg, units)}</span>
              <DeltaBadge delta={e.topDeltaKg} format={(n) => fmtWeight(n, units)} />
            </div>
          </div>
          <div className="mt-1 text-xs text-muted">
            {e.sets.map((s, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {s.reps}×{fmtWeight(s.weightKg, units)}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            vol {fmtVolume(e.volumeKg, units)}
            <DeltaBadge delta={e.volumeDeltaKg} format={(n) => fmtVolume(n, units)} />
          </div>
        </Link>
      ))}
    </div>
  );
}
