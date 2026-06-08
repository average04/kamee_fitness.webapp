import {
  relativeTime,
  type ActivityEvent,
  type ActivityType,
} from "@/lib/admin/metrics";

const META: Record<ActivityType, { dot: string; tag: string }> = {
  user: { dot: "#10b981", tag: "User" },
  waitlist: { dot: "#38bdf8", tag: "Waitlist" },
  subscription: { dot: "#a78bfa", tag: "Sub" },
  workout: { dot: "#f59e0b", tag: "Workout" },
  exercise: { dot: "#94a3b8", tag: "Exercise" },
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-600">No recent activity.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-800/70">
      {events.map((e, i) => {
        const meta = META[e.type];
        return (
          <li
            key={`${e.type}-${e.at}-${i}`}
            className="flex items-center gap-3 py-2 text-sm"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: meta.dot }}
            />
            <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-zinc-500">
              {meta.tag}
            </span>
            <span className="min-w-0 flex-1 truncate text-zinc-300">
              {e.label}
            </span>
            <time className="shrink-0 text-xs text-zinc-500">
              {relativeTime(e.at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
