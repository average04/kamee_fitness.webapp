"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MuscleBar } from "@/lib/admin/metrics";
import { AXIS, ChartEmpty, EMERALD, TOOLTIP } from "./chart-ui";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MuscleBars({ data }: { data: MuscleBar[] }) {
  if (data.length === 0) return <ChartEmpty />;
  const height = Math.max(160, data.length * 26);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        barCategoryGap={6}
      >
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="muscle"
          width={92}
          tickFormatter={cap}
          {...AXIS}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v) => [v, "Exercises"]}
          labelFormatter={(v) => cap(String(v))}
          contentStyle={TOOLTIP.contentStyle}
          labelStyle={TOOLTIP.labelStyle}
          itemStyle={TOOLTIP.itemStyle}
        />
        <Bar
          dataKey="count"
          fill={EMERALD}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
