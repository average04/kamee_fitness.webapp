"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS,
  ChartEmpty,
  EMERALD,
  GRID_STROKE,
  SKY,
  shortDate,
  TOOLTIP,
} from "./chart-ui";

type Point = { date: string; workout: number; cardio: number };

export function SessionsChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, d) => s + d.workout + d.cardio, 0);
  if (total === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          minTickGap={28}
          {...AXIS}
        />
        <YAxis allowDecimals={false} width={28} {...AXIS} />
        <Tooltip labelFormatter={(v) => shortDate(String(v))} {...TOOLTIP} />
        <Bar
          dataKey="workout"
          name="Workouts"
          stackId="s"
          fill={EMERALD}
          isAnimationActive={false}
        />
        <Bar
          dataKey="cardio"
          name="Cardio"
          stackId="s"
          fill={SKY}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
