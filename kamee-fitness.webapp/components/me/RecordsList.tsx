import Link from "next/link";
import type { ExerciseRecord } from "@/lib/me/records";
import { fmtWeight, type Units } from "@/lib/me/units";

export default function RecordsList({
  records,
  units,
}: {
  records: ExerciseRecord[];
  units: Units;
}) {
  return (
    <ul className="divide-y divide-white/8 border-y border-white/8">
      {records.map((r) => (
        <li key={r.exerciseId}>
          <Link
            href={`/me/exercises/${r.exerciseId}`}
            className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-leaf-300"
          >
            <span className="min-w-0 truncate font-display font-semibold text-mist">
              {r.name}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className="text-leaf-400">{fmtWeight(r.prKg, units)}</span>
              <span className="hidden text-xs text-muted sm:inline">
                {r.prDateIso ?? ""} · 1RM {fmtWeight(r.est1RmKg, units)} ·{" "}
                {r.timesTrained}×
              </span>
              <span className="text-muted" aria-hidden>
                →
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
