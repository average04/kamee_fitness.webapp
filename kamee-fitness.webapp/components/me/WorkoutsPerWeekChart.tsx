"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function WorkoutsPerWeekChart({
  data,
}: {
  data: { week: string; count: number }[];
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="week"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(w: string) => w.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0e1416",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#eef4f0",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#7dbe8d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
