"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function WeightChart({
  data,
  targetKg,
}: {
  data: { date: string; kg: number }[];
  targetKg: number | null;
}) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            width={28}
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
          {targetKg != null && (
            <ReferenceLine
              y={targetKg}
              stroke="#efb54e"
              strokeDasharray="4 4"
              label={{ value: "goal", fill: "#efb54e", fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="kg"
            stroke="#9bd2a8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
