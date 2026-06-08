import { requireAdmin } from "@/lib/admin/auth";
import { pct } from "@/lib/admin/metrics";
import { ActivityFeed } from "@/components/admin/dashboard/ActivityFeed";
import {
  EMERALD,
  LegendDot,
  SKY,
} from "@/components/admin/dashboard/chart-ui";
import { MuscleBars } from "@/components/admin/dashboard/MuscleBars";
import { SessionsChart } from "@/components/admin/dashboard/SessionsChart";
import { StatCard } from "@/components/admin/dashboard/StatCard";
import { StoreDonut } from "@/components/admin/dashboard/StoreDonut";
import { TrendChart } from "@/components/admin/dashboard/TrendChart";
import { loadDashboard } from "./metrics";

export const dynamic = "force-dynamic";

function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        {legend && <div className="flex items-center gap-3">{legend}</div>}
      </div>
      {children}
    </div>
  );
}

function CoverageBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const p = pct(value, total);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-500">
          {p}% · {value}/{total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full"
          style={{ width: `${p}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  await requireAdmin();
  const d = await loadDashboard();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <span className="text-xs text-zinc-500">Trends over the last 30 days</span>
      </div>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total users" value={d.totals.users} />
        <StatCard
          label="New users"
          value={d.totals.newUsers30d}
          delta={d.totals.newUsers7d}
          hint="last 30d"
        />
        <StatCard
          label="Waitlist"
          value={d.totals.waitlist}
          delta={d.totals.waitlist7d}
        />
        <StatCard
          label="Active subs"
          value={d.totals.activeSubs}
          hint={`${d.totals.premiumPct}% of users`}
        />
        <StatCard label="Workouts" value={d.totals.workouts30d} hint="last 30d" />
        <StatCard label="Cardio" value={d.totals.cardio30d} hint="last 30d" />
      </section>

      {/* Trend charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Signups"
          legend={
            <>
              <LegendDot color={EMERALD} label="New users" />
              <LegendDot color={SKY} label="Waitlist" />
            </>
          }
        >
          <TrendChart data={d.signups} />
        </ChartCard>
        <ChartCard
          title="Sessions"
          legend={
            <>
              <LegendDot color={EMERALD} label="Workouts" />
              <LegendDot color={SKY} label="Cardio" />
            </>
          }
        >
          <SessionsChart data={d.sessions} />
        </ChartCard>
      </section>

      {/* Monetization + catalog */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Subscriptions">
          <StoreDonut data={d.subsByStore} />
          <div className="mt-3 flex gap-4 border-t border-zinc-800 pt-3 text-xs">
            <span className="text-emerald-400">
              {d.willRenew.renewing} renewing
            </span>
            <span className="text-zinc-500">
              {d.willRenew.churning} not renewing
            </span>
          </div>
        </ChartCard>
        <ChartCard title="Exercises by muscle">
          <MuscleBars data={d.muscles} />
          <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            <CoverageBar
              label="Image demos"
              value={d.coverage.withImage}
              total={d.coverage.total}
              color={EMERALD}
            />
            <CoverageBar
              label="Video demos"
              value={d.coverage.withVideo}
              total={d.coverage.total}
              color={SKY}
            />
          </div>
        </ChartCard>
      </section>

      {/* Activity */}
      <ChartCard title="Recent activity">
        <ActivityFeed events={d.activity} />
      </ChartCard>
    </div>
  );
}
