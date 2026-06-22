import { routeToPolyline } from "@/lib/me/route";

const SIZE = 320;

export default function RouteMap({ routePoints }: { routePoints: unknown }) {
  const points = routeToPolyline(routePoints, SIZE);
  if (!points) {
    return (
      <div className="grid h-44 place-items-center rounded-2xl border border-white/8 bg-white/[0.02] text-xs text-muted">
        No route recorded
      </div>
    );
  }
  const coords = points.split(" ");
  const [sx, sy] = coords[0].split(",");
  const [ex, ey] = coords[coords.length - 1].split(",");
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full rounded-2xl border border-white/8 bg-white/[0.02]"
      role="img"
      aria-label="Route map"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-teal-500)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={5} fill="#9bd2a8" />
      <circle cx={ex} cy={ey} r={5} fill="#efb54e" />
    </svg>
  );
}
