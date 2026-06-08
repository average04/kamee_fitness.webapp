import type { DayKind, PlanWeekNode } from "@/lib/admin/plans";

const DAY_TONE: Record<DayKind, string> = {
  workout: "border-emerald-800 text-emerald-300",
  rest: "border-zinc-700 text-zinc-400",
  active_recovery: "border-sky-800 text-sky-300",
};

export function PlanTreeView({ weeks }: { weeks: PlanWeekNode[] }) {
  if (weeks.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No structure yet — add weeks, days, blocks and exercises in the builder.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.map((w, wi) => (
        <div key={w.id} className="rounded-xl border border-zinc-800">
          <div className="border-b border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200">
            Week {wi + 1}
          </div>
          <div className="divide-y divide-zinc-800/60">
            {w.days.length === 0 && (
              <p className="px-4 py-3 text-xs text-zinc-600">No days</p>
            )}
            {w.days.map((d, di) => (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-300">
                    Day {di + 1}
                    {d.title ? ` · ${d.title}` : ""}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${DAY_TONE[d.day_kind]}`}
                  >
                    {d.day_kind.replace(/_/g, " ")}
                  </span>
                </div>

                {d.blocks.map((b) => (
                  <div key={b.id} className="ml-3 mt-2">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      {b.kind}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {b.exercises.length === 0 && (
                        <li className="text-xs text-zinc-600">No exercises</li>
                      )}
                      {b.exercises.map((e) => (
                        <li key={e.id} className="text-sm text-zinc-300">
                          <span className="text-zinc-500">
                            {e.sets}×{e.reps}
                          </span>{" "}
                          {e.exercise_name ?? e.exercise_id}
                          {e.rest_seconds ? (
                            <span className="text-zinc-500">
                              {" "}
                              · {e.rest_seconds}s rest
                            </span>
                          ) : null}
                          {e.weight_hint ? (
                            <span className="text-zinc-500"> · {e.weight_hint}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {d.blocks.length === 0 && d.day_kind === "workout" && (
                  <p className="ml-3 mt-1 text-xs text-zinc-600">No blocks</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
