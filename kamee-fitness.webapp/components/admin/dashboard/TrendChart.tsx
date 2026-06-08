"use client";

import {
  Area,
  AreaChart,
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

type Point = { date: string; users: number; waitlist: number };

export function TrendChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, d) => s + d.users + d.waitlist, 0);
  if (total === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="grad-users" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grad-waitlist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SKY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          minTickGap={28}
          {...AXIS}
        />
        <YAxis allowDecimals={false} width={28} {...AXIS} />
        <Tooltip labelFormatter={(v) => shortDate(String(v))} {...TOOLTIP} />
        <Area
          type="monotone"
          dataKey="users"
          name="New users"
          stroke={EMERALD}
          strokeWidth={2}
          fill="url(#grad-users)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="waitlist"
          name="Waitlist"
          stroke={SKY}
          strokeWidth={2}
          fill="url(#grad-waitlist)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
