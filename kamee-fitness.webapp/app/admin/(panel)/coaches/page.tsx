import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { InviteBlock } from "@/components/admin/coaching/InviteBlock";
import { findUserForInvite, listCoachUsers, listLatestInvites } from "./queries";

const STATUS_LABEL: Record<string, string> = {
  none: "None",
  pending: "Pending",
  rejected: "Rejected",
  invited: "Invited",
  onboarding: "Onboarding",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  suspended: "Suspended",
  revoked: "Revoked",
};

const STATUS_CLASS: Record<string, string> = {
  none: "bg-zinc-800 text-zinc-400",
  pending: "bg-zinc-800 text-zinc-400",
  rejected: "bg-red-950 text-red-400",
  invited: "bg-sky-950 text-sky-400",
  onboarding: "bg-sky-950 text-sky-400",
  in_review: "bg-amber-950 text-amber-400",
  changes_requested: "bg-amber-950 text-amber-400",
  approved: "bg-emerald-950 text-emerald-400",
  suspended: "bg-orange-950 text-orange-400",
  revoked: "bg-red-950 text-red-400",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status] ?? "bg-zinc-800 text-zinc-400"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

/** Invite/Resend is only valid from these coach_status values (mirrors admin_invite_coach's wrong_state check). */
const INVITABLE_STATUSES = new Set(["none", "pending", "rejected", "invited"]);

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const query = q.trim();

  const [rows, candidate] = await Promise.all([
    listCoachUsers(),
    query ? findUserForInvite(query) : Promise.resolve(null),
  ]);
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
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by username or email…"
            className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
          />
          <button className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm">
            Search
          </button>
        </form>

        {query && !candidate && (
          <p className="text-sm text-zinc-500">No user found for &quot;{query}&quot;.</p>
        )}

        {candidate && (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div>
              <p className="text-sm text-zinc-200">
                {candidate.display_name ?? candidate.username ?? candidate.id}
              </p>
              {candidate.username && (
                <p className="text-xs text-zinc-500">@{candidate.username}</p>
              )}
              <div className="mt-1">
                <StatusPill status={candidate.coach_status} />
              </div>
            </div>
            {INVITABLE_STATUSES.has(candidate.coach_status) ? (
              <InviteBlock
                userId={candidate.id}
                label={candidate.coach_status === "invited" ? "Resend" : "Invite"}
              />
            ) : (
              <p className="text-xs text-zinc-500">
                Already past the invite stage — open their profile below.
              </p>
            )}
          </div>
        )}
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
