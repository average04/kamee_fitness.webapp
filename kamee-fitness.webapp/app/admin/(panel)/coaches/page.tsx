import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { CoachSearch } from "@/components/admin/coaching/CoachSearch";
import { fmtDate } from "@/components/admin/coaching/format";
import { StatusPill } from "@/components/admin/coaching/status";
import { listCoachUsers, listLatestInvites } from "./queries";

export default async function CoachesPage() {
  await requireAdmin();

  const rows = await listCoachUsers();
  const invites = await listLatestInvites(rows.map((r) => r.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">
          Coaches <span className="text-zinc-500">({rows.length})</span>
        </h1>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-300">Invite a user</h2>
        <CoachSearch />
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="py-2 pr-4 font-medium">Username</th>
            <th className="py-2 pr-4 font-medium">Display name</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Invited</th>
            <th className="py-2 pr-4 font-medium">Accepted</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const invite = invites[r.id];
            return (
              <tr key={r.id} className="border-b border-zinc-900">
                <td className="py-2 pr-4 text-zinc-300">
                  {r.username ? `@${r.username}` : "—"}
                </td>
                <td className="py-2 pr-4">{r.display_name ?? "—"}</td>
                <td className="py-2 pr-4">
                  <StatusPill status={r.coach_status} />
                </td>
                <td className="py-2 pr-4 text-zinc-400">
                  {invite ? fmtDate(invite.created_at) : "—"}
                </td>
                <td className="py-2 pr-4 text-zinc-400">
                  {invite ? fmtDate(invite.accepted_at) : "—"}
                </td>
                <td className="py-2">
                  <Link
                    href={`/admin/coaches/${r.id}`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-zinc-500">
                No coaches yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
