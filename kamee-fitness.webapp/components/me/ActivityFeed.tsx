import type { FeedItem as Item } from "@/lib/me/feed";
import type { Units } from "@/lib/me/units";
import FeedItem from "./FeedItem";

export default function ActivityFeed({
  items,
  units,
}: {
  items: Item[];
  units: Units;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={`${it.kind}-${it.id}`}>
          <FeedItem item={it} units={units} />
        </li>
      ))}
    </ul>
  );
}
