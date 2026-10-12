import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";
import { DeletionPanel } from "./DeletionPanel";

// Per-visitor content (signed-in state + their own pending request).
export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pendingPurgeAfter: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("account_deletion_requests")
      .select("purge_after")
      .eq("user_id", user.id)
      .maybeSingle();
    pendingPurgeAfter = (data?.purge_after as string | undefined) ?? null;
  }

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="max-w-2xl mx-auto px-6 py-12 lg:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="text-sm text-ink-400 hover:text-leaf-400 inline-flex items-center gap-1"
          >
            ← Kamee Fitness
          </Link>
          <h1 className="text-4xl lg:text-5xl font-bold text-leaf-300 mt-4">
            Delete your Kamee Fitness account
          </h1>
        </header>

        {/* In-app deletion */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-ink-100 mb-3">
            Delete in the app
          </h2>
          <p className="text-ink-300 mb-4">
            The fastest way to delete your account is directly inside the app:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-ink-300">
            <li>
              Open <span className="text-ink-100 font-medium">Kamee Fitness</span>
            </li>
            <li>
              Go to{" "}
              <span className="text-ink-100 font-medium">Profile</span>
            </li>
            <li>
              Tap{" "}
              <span className="text-ink-100 font-medium">Delete account</span>
            </li>
            <li>
              Type <span className="font-mono text-ink-100">DELETE</span> to
              confirm
            </li>
          </ol>
          <p className="mt-4 text-ink-400 text-sm">
            Your account and all data are permanently deleted 30 days after you
            confirm. Sign back in before then to cancel.
          </p>
        </section>

        {/* What gets removed */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-ink-100 mb-3">
            What gets removed
          </h2>
          <ul className="list-disc list-inside space-y-2 text-ink-300">
            <li>Profile and settings</li>
            <li>Workouts and track history</li>
            <li>Buddy connections and invites</li>
          </ul>
        </section>

        {/* Web deletion: prove the account is yours, then schedule it */}
        <section>
          <h2 className="text-xl font-semibold text-ink-100 mb-2">
            Can&rsquo;t open the app? Delete it here
          </h2>
          {user ? (
            <DeletionPanel email={user.email ?? ""} pendingPurgeAfter={pendingPurgeAfter} />
          ) : (
            <>
              <p className="text-ink-400 text-sm">
                Sign in with the email address on your account. We&rsquo;ll email you a
                6-digit code to confirm the account is yours, then you can schedule
                its deletion.
              </p>
              <EmailCodeSignIn
                next="/delete-account"
                fallbackNext="/delete-account"
                sendLabel="Email me a code"
              />
              <p className="mt-6 text-ink-500 text-xs">
                Signed up with Apple or Google? Use the same email address that
                account uses. Can&rsquo;t receive email there? Write to{" "}
                <a href="mailto:support@kamee.fit" className="text-leaf-400 underline">
                  support@kamee.fit
                </a>{" "}
                from that address.
              </p>
            </>
          )}
        </section>

        <footer className="mt-16 pt-6 border-t border-ink-700 text-xs text-ink-500">
          Questions? Email{" "}
          <a
            href="mailto:support@kamee.fit"
            className="text-leaf-400 underline"
          >
            support@kamee.fit
          </a>
          .
        </footer>
      </div>
    </main>
  );
}
