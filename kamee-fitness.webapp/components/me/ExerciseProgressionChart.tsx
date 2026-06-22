"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ExerciseProgressionChart({
  data,
}: {
  data: { dateIso: string; topSetKg: number; est1RmKg: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="dateIso"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            width={32}
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
          <Line
            type="monotone"
            dataKey="topSetKg"
            stroke="#9bd2a8"
            strokeWidth={2}
            dot={false}
            name="Top set"
          />
          <Line
            type="monotone"
            dataKey="est1RmKg"
            stroke="#efb54e"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="Est 1RM"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
