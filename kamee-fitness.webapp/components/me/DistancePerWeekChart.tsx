"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function DistancePerWeekChart({
  data,
}: {
  data: { week: string; km: number }[];
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fb6c0" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3fb6c0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="week"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(w: string) => w.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0e1416",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#eef4f0",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="km"
            stroke="#3fb6c0"
            strokeWidth={2}
            fill="url(#distFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
