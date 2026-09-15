import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCoachSession } from "@/lib/coaching/auth";
import { isHubState } from "@/lib/coaching/states";
import { AcceptInvite } from "@/components/coaching/AcceptInvite";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";
import { signOutFromInvite } from "@/app/coaching/invite/actions";
import { getInviteIdentity } from "@/lib/coaching/invite-identity";

/**
 * Both invite entry points render this: the emailed link
 * (/coaching/invite/<token>) and the in-app invite notification, which opens
 * /coaching/invite in the browser. Coaches arrive signed out more often than
 * not, so the card signs them in itself (proxy exception in
 * lib/coaching/public-paths.ts) instead of bouncing them to the generic
 * /login page, then shows Accept. A valid token prefills its recipient email;
 * accept_coaching_invite still checks ownership against the signed-in user.
 */
export async function InviteCard({ token }: { token?: string }) {
  const s = await getCoachSession();
  const identity = token ? await getInviteIdentity(token) : null;
  const wrongAccount = !!(identity && s.user && identity.userId !== s.user.id);
  if (s.user && isHubState(s.status) && !wrongAccount) redirect("/coaching/profile");

  const path = token ? `/coaching/invite/${encodeURIComponent(token)}` : "/coaching/invite";

  return (
    <main className="coach-invite">
      <section className="coach-invite-form">
      <div className="w-full">
        <Link href="/" className="coach-brand" aria-label="Kamee home"><Image src="/adaptive-icon.png" width={38} height={38} className="coach-brand-mark" alt="" /><span>kamee</span></Link>
        <h1>
          You&apos;re invited to coach on Kamee
        </h1>

        {token && !identity ? (
          <p className="mt-4 text-sm text-muted">This invitation is no longer available. It may have expired, been replaced, or already been accepted. Ask the admin for a new link.</p>
        ) : s.user ? (
          <>
            <p className="mt-2 text-sm text-muted">
              {wrongAccount ? `This invitation is for ${identity!.email}. Sign out below, then sign in with the invited email.` : "Accept the invite to set up your coach profile."}
            </p>
            {!wrongAccount && <AcceptInvite token={token} />}
            <form action={signOutFromInvite} className="mt-4 text-xs text-muted">
              {token && <input type="hidden" name="token" value={token} />}
              Signed in as {s.user.email ?? "your Kamee account"}.{" "}
              <button type="submit" className="text-leaf-500 underline hover:text-leaf-400">
                Not you? Sign out
              </button>
            </form>
          </>
        ) : (
          <div className="text-left">
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {identity ? "Your invited email is filled in below. We’ll send the sign-in code to this address." : "Sign in with the email that received your invite."}
            </p>
            <EmailCodeSignIn next={path} fallbackNext={path} invitedEmail={identity?.email} sendLabel="Email me a sign-in code" />
          </div>
        )}
      </div>
      </section>
    </main>
  );
}
