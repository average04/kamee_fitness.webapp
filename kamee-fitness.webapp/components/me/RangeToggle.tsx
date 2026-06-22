"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Range } from "@/lib/me/range";

const PRESETS: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

export default function RangeToggle({
  range,
  from,
  to,
}: {
  range: Range;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `/me?${qs}` : "/me");
  }

  function selectPreset(value: Range) {
    const next = new URLSearchParams(params);
    if (value === "all") {
      next.delete("range");
      next.delete("from");
      next.delete("to");
    } else if (value === "custom") {
      next.set("range", "custom"); // keep any existing from/to
    } else {
      next.set("range", value);
      next.delete("from");
      next.delete("to");
    }
    push(next);
  }

  function setDate(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params);
    next.set("range", "custom");
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
        {PRESETS.map((o) => (
          <button
            key={o.value}
            onClick={() => selectPreset(o.value)}
            className={
              "rounded-full px-3 py-1 font-medium transition-colors " +
              (range === o.value
                ? "bg-leaf-600 text-white"
                : "text-muted hover:text-mist")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="date"
            aria-label="From date"
            value={from ?? ""}
            max={to || undefined}
            onChange={(e) => setDate("from", e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-mist outline-none focus:border-leaf-600"
          />
          <span aria-hidden>→</span>
          <input
            type="date"
            aria-label="To date"
            value={to ?? ""}
            min={from || undefined}
            onChange={(e) => setDate("to", e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-mist outline-none focus:border-leaf-600"
          />
        </div>
      )}
    </div>
  );
}
