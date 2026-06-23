import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { buildFeed } from "@/lib/me/feed";
import BackLink from "@/components/me/BackLink";
import ActivityFeed from "@/components/me/ActivityFeed";

export const metadata = { title: "Day" };

function prettyDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { date } = await params;
  const data = await loadMeData(supabase, user.id);
  const units = data.profile?.units ?? "metric";

  const workouts = data.workouts.filter(
    (w) => w.started_at.slice(0, 10) === date,
  );
  const tracks = data.tracks.filter(
    (t) => (t.finished_at ?? t.created_at).slice(0, 10) === date,
  );
  const feed = buildFeed(workouts, data.sets, tracks, data.dayTitleBySession, 50);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist">
        {prettyDate(date)}
      </h1>
      <div className="mt-6">
        {feed.length ? (
          <ActivityFeed items={feed} units={units} />
        ) : (
          <p className="text-sm text-muted">Nothing logged on this day.</p>
        )}
      </div>
    </main>
  );
}
