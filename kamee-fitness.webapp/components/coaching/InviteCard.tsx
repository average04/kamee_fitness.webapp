import Link from "next/link";
import { redirect } from "next/navigation";
import { getCoachSession } from "@/lib/coaching/auth";
import { isHubState } from "@/lib/coaching/states";
import { AcceptInvite } from "@/components/coaching/AcceptInvite";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";
import { signOutFromInvite } from "@/app/coaching/invite/actions";

/**
 * Both invite entry points render this: the emailed link
 * (/coaching/invite/<token>) and the in-app invite notification, which opens
 * /coaching/invite in the browser. Coaches arrive signed out more often than
 * not, so the card signs them in itself (proxy exception in
 * lib/coaching/public-paths.ts) instead of bouncing them to the generic
 * /login page, then shows Accept. Nothing about the invite (who it is for)
 * is shown before sign-in; accept_coaching_invite checks the invite belongs
 * to the signed-in account.
 */
export async function InviteCard({ token }: { token?: string }) {
  const s = await getCoachSession();
  if (s.user && isHubState(s.status)) redirect("/coaching/onboarding");

  const path = token ? `/coaching/invite/${encodeURIComponent(token)}` : "/coaching/invite";

  return (
    <main className="coach-invite">
      <section className="coach-invite-story" aria-label="Welcome to Kamee coaching">
        <Link href="/" className="coach-brand" aria-label="Kamee home"><span className="coach-brand-mark" aria-hidden="true">k</span><span>kamee<small>COACHING</small></span></Link>
        <div><h2>Your experience.<br />Their <em>next chapter.</em></h2><p>A space to share what you know, show who you are, and help people move forward.</p></div>
        <footer>STRONGER TOGETHER. ONE STEP AT A TIME.</footer>
      </section>
      <section className="coach-invite-form">
      <div className="w-full">
        <p className="coach-eyebrow">WELCOME TO YOUR COACHING SPACE</p>
        <h1>
          You&apos;re invited to coach on Kamee
        </h1>

        {s.user ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Accept the invite to set up your coach profile.
            </p>
            <AcceptInvite token={token} />
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
              Sign in with the email this invite was sent to, the same one you use in the Kamee
              app. You&apos;ll accept the invite right after.
            </p>
            <EmailCodeSignIn theme="light" next={path} fallbackNext={path} sendLabel="Email me a sign-in code" />
          </div>
        )}
      </div>
      </section>
    </main>
  );
}
