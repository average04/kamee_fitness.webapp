import type { CSSProperties, ReactNode } from "react";
import { GPS_POINTS } from "@/lib/landing/content";

const MAP_SURFACE: CSSProperties = {
  backgroundColor: "#0b1013",
  backgroundImage:
    "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "34px 34px",
};

const ROUTE_GLOW: CSSProperties = {
  filter: "drop-shadow(0 0 8px rgba(63,182,192,0.65))",
};

interface Split {
  km: string;
  width: string;
  bar: string;
  time: string;
}

const SPLITS: Split[] = [
  { km: "KM 1", width: "72%", bar: "bg-teal-600", time: "5'51\"" },
  { km: "KM 2", width: "82%", bar: "bg-teal-500/80", time: "5'44\"" },
  { km: "KM 3", width: "92%", bar: "bg-teal-500", time: "5'38\"" },
];

interface Zone {
  key: string;
  basis: string;
  bar: string;
}

const HR_ZONES: Zone[] = [
  { key: "z1", basis: "22%", bar: "bg-[#2e4e44]" },
  { key: "z2", basis: "38%", bar: "bg-leaf-700" },
  { key: "z3", basis: "28%", bar: "bg-ember-500" },
  { key: "z4", basis: "12%", bar: "bg-[#d96a4a]" },
];

const ICONS: Record<string, ReactNode> = {
  splits: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  voice: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  hr: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />,
  replay: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 16 12l-6 3.5z" />
    </>
  ),
  offline: (
    <>
      <path d="m2 2 20 20" />
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
      <path d="M22 8.8a15 15 0 0 0-11.3-3.8" />
      <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
      <path d="M19 12.9a10 10 0 0 0-2-1.5" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </>
  ),
};

export default function GpsSection() {
  return (
    <section
      id="gps"
      className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-teal-500">
        Record &middot; GPS
      </p>
      <h2 className="mt-3 max-w-3xl font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
        Every run mapped, measured, <span className="text-teal-500">replayed.</span>
      </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Mock: map + splits panel */}
        <div className="overflow-hidden rounded-3xl border border-teal-500/20 bg-ink-900">
          <div
            className="relative aspect-[16/9] w-full sm:aspect-[16/10]"
            style={MAP_SURFACE}
          >
            <svg
              viewBox="0 0 560 300"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              <polyline
                points="46,252 120,214 176,232 236,168 306,186 352,120 424,138 470,84 516,60"
                fill="none"
                stroke="#3fb6c0"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={ROUTE_GLOW}
              />
              <circle cx="46" cy="252" r="6" fill="#3fb6c0" />
              <circle
                cx="516"
                cy="60"
                r="6"
                fill="#0b1013"
                stroke="#3fb6c0"
                strokeWidth={3}
              />
            </svg>

            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-ink-950/85 px-3 py-1.5 sm:left-4 sm:top-4">
              <span className="blink size-1.5 rounded-full bg-teal-500" />
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[#b8e4e8]">
                Live
              </span>
            </div>

            <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-2 sm:inset-x-4 sm:bottom-4">
              <span className="rounded-lg border border-white/10 bg-ink-950/85 px-2.5 py-2 text-[0.8125rem] font-bold text-mist">
                5.2 <span className="text-[0.6875rem] font-semibold text-muted">KM</span>
              </span>
              <span className="rounded-lg border border-white/10 bg-ink-950/85 px-2.5 py-2 text-[0.8125rem] font-bold text-mist">
                5&apos;42&quot;{" "}
                <span className="text-[0.6875rem] font-semibold text-muted">/KM</span>
              </span>
              <span className="rounded-lg border border-white/10 bg-ink-950/85 px-2.5 py-2 text-[0.8125rem] font-bold text-mist">
                +132{" "}
                <span className="text-[0.6875rem] font-semibold text-muted">M ELEV</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/6 p-5 sm:p-6">
            {SPLITS.map((s) => (
              <div key={s.km} className="flex items-center gap-3">
                <span className="w-11 shrink-0 text-[0.75rem] font-bold text-muted">
                  {s.km}
                </span>
                <span className="h-2 min-w-0 flex-1 rounded bg-white/8">
                  <span
                    className={"block h-2 rounded " + s.bar}
                    style={{ width: s.width }}
                  />
                </span>
                <span className="shrink-0 text-[0.8125rem] font-bold tabular-nums text-mist">
                  {s.time}
                </span>
              </div>
            ))}

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-muted">
                Heart rate
              </span>
              <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                {HR_ZONES.map((z) => (
                  <span
                    key={z.key}
                    className={"h-full " + z.bar}
                    style={{ flexBasis: z.basis }}
                  />
                ))}
              </span>
              <span className="shrink-0 text-[0.8125rem] font-bold tabular-nums text-mist">
                148 <span className="font-semibold text-muted">BPM AVG</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bullets */}
        <div>
          <div className="flex flex-col gap-5">
            {GPS_POINTS.map((p) => (
              <div key={p.key} className="flex gap-3.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 size-5 shrink-0 text-teal-500"
                  aria-hidden="true"
                >
                  {ICONS[p.key]}
                </svg>
                <p className="text-[0.9375rem] leading-relaxed text-mist/75">
                  <b className="font-semibold text-mist">{p.title}</b> &mdash; {p.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-teal-500"
              aria-hidden="true"
            >
              <rect x="5" y="2" width="14" height="20" rx="2.5" />
              <path d="M12 18h.01" />
            </svg>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Live Activity on the iPhone lock screen
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
