import type { HeatmapDay } from "@/lib/me/heatmap";

const CELL = 11;
const GAP = 3;

function shade(count: number, max: number): string {
  if (count <= 0) return "rgba(255,255,255,0.05)";
  const t = max <= 1 ? 1 : count / max;
  const alpha = 0.25 + t * 0.6; // 0.25..0.85
  return `rgba(125,190,141,${alpha.toFixed(2)})`; // leaf-500
}

export default function ActivityHeatmap({
  days,
  maxCount,
}: {
  days: HeatmapDay[];
  maxCount: number;
}) {
  const weeks = Math.ceil(days.length / 7);
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);
  const active = days.filter((d) => d.count > 0).length;
  return (
    <figure className="overflow-x-auto">
      <figcaption className="sr-only">
        Activity over the last {weeks} weeks: {active} active days.
      </figcaption>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${active} active days in the last ${weeks} weeks`}
      >
        {days.map((d, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const cell = (
            <rect
              x={col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={shade(d.count, maxCount)}
            >
              <title>{`${d.date}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}</title>
            </rect>
          );
          return d.count > 0 ? (
            <a key={d.date} href={`/me/day/${d.date}`}>
              {cell}
            </a>
          ) : (
            <g key={d.date}>{cell}</g>
          );
        })}
      </svg>
    </figure>
  );
}
