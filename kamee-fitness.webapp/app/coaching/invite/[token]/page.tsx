import { redirect } from "next/navigation";
import { getCoachSession } from "@/lib/coaching/auth";
import { isHubState } from "@/lib/coaching/states";
import { AcceptInvite } from "@/components/coaching/AcceptInvite";

export const metadata = { title: "Coach invite" };

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const s = await getCoachSession();

  if (!s.user) {
    const path = `/coaching/invite/${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (isHubState(s.status)) redirect("/coaching/onboarding");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="font-display text-xl font-semibold">
          You&apos;re invited to coach on Kamee
        </h1>
        <p className="mt-2 text-sm text-muted">
          Accept the invite to set up your coach profile.
        </p>
        <AcceptInvite token={token} />
      </div>
    </main>
  );
}
