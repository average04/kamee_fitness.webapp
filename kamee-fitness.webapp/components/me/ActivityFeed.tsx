import type { FeedItem as Item } from "@/lib/me/feed";
import type { Units } from "@/lib/me/units";
import { groupFeedByDate } from "@/lib/me/feedGroups";
import FeedItem from "./FeedItem";

export default function ActivityFeed({
  items,
  units,
}: {
  items: Item[];
  units: Units;
}) {
  if (!items.length) return null;
  const groups = groupFeedByDate(items, new Date());
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
            {g.label}
          </h3>
          <ul className="space-y-2">
            {g.items.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <FeedItem item={it} units={units} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
