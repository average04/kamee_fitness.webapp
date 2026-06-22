import { routeToPolyline } from "@/lib/me/route";

const SIZE = 96;

export default function RouteThumbnail({
  routePoints,
  accent = "var(--color-teal-500)",
}: {
  routePoints: unknown;
  accent?: string;
}) {
  const points = routeToPolyline(routePoints, SIZE);
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="shrink-0 rounded-xl border border-white/8 bg-white/[0.02]"
      role="img"
      aria-label="Route map"
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1="20"
          y1="76"
          x2="76"
          y2="20"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
