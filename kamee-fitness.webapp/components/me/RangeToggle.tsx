"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Range } from "@/lib/me/range";

const OPTIONS: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

export default function RangeToggle({ range }: { range: Range }) {
  const router = useRouter();
  const params = useSearchParams();
  function set(value: Range) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("range");
    else next.set("range", value);
    const qs = next.toString();
    router.push(qs ? `/me?${qs}` : "/me");
  }
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
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
  );
}
