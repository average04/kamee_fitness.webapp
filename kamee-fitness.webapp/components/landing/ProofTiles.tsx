import type { ReactNode } from "react";
import { TICKER, type FeatureAccent } from "@/lib/landing/content";

const DOT: Record<FeatureAccent, string> = {
  leaf: "bg-leaf-500",
  teal: "bg-teal-500",
};

const CHIP_TEXT: Record<FeatureAccent, string> = {
  leaf: "text-leaf-300",
  teal: "text-[#b8e4e8]",
};

/** Sun-yellow bar sits on day 4 — the session the week points at. */
const WEEK_BARS = [
  "bg-white/[0.06]",
  "bg-leaf-500/25",
  "bg-white/[0.06]",
  "bg-sun-500/90",
  "bg-white/[0.06]",
  "bg-white/[0.06]",
  "bg-white/[0.06]",
];

const LOG_ROWS = ["3 × 8", "4 × 6", "5 km"];

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
      {children}
      <p className="text-[0.8125rem] font-semibold text-mist/85">{label}</p>
    </div>
  );
}

export default function ProofTiles() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Live GPS route">
          <svg
            viewBox="0 0 214 58"
            className="h-12 w-full sm:h-14"
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            aria-hidden
          >
            <path
              d="M9 47C31 47 27 17 55 18c30 1 26 30 58 28 30-2 32-32 62-32h28"
              stroke="#3fb6c0"
              strokeOpacity={0.18}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 47C31 47 27 17 55 18c30 1 26 30 58 28 30-2 32-32 62-32h28"
              stroke="#3fb6c0"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={9} cy={47} r={4.5} fill="#07090a" stroke="#3fb6c0" strokeWidth={2.5} />
            <circle cx={203} cy={14} r={4.5} fill="#3fb6c0" />
          </svg>
        </Tile>

        <Tile label="Synced schedule">
          <div className="grid h-12 grid-cols-7 gap-1.5 sm:h-14" aria-hidden>
            {WEEK_BARS.map((bar, i) => (
              <div key={i} className={"h-full rounded-md " + bar} />
            ))}
          </div>
        </Tile>

        <Tile label="Coach Kamy">
          <div className="flex h-12 flex-col justify-center gap-1.5 sm:h-14" aria-hidden>
            <div className="h-5 w-[70%] rounded-xl rounded-bl-sm border border-leaf-500/30 bg-leaf-500/15" />
            <div className="ml-auto h-5 w-[52%] rounded-xl rounded-br-sm border border-white/12 bg-white/5" />
          </div>
        </Tile>

        <Tile label="Every rep logged">
          <div className="flex h-12 flex-col justify-between sm:h-14" aria-hidden>
            {LOG_ROWS.map((row) => (
              <div key={row} className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5 shrink-0 text-leaf-400"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 L9 17 L4 12" />
                </svg>
                <div className="h-1 flex-1 rounded-full bg-white/10" />
                <span className="shrink-0 text-[0.6875rem] font-semibold text-muted">
                  {row}
                </span>
              </div>
            ))}
          </div>
        </Tile>
      </div>
    </div>
  );
}

export function Ticker() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
      <div className="flex snap-x gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:justify-center lg:overflow-visible">
        {TICKER.map((item) => (
          <div
            key={item.key}
            className={
              "flex min-h-11 shrink-0 snap-start items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 text-[0.8125rem] font-semibold " +
              CHIP_TEXT[item.accent]
            }
          >
            <span className={"size-[7px] shrink-0 rounded-full " + DOT[item.accent]} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
