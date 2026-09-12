"use server";

import { redirect } from "next/navigation";
import { getCoachSession } from "@/lib/coaching/auth";
import { isHubState } from "@/lib/coaching/states";
import { createServerSupabase } from "@/lib/supabase/server";
import type { FormState } from "@/lib/coaching/profile";

/** Invite tokens are hex; anything else is not ours to put in a redirect. */
function invitePath(token: FormDataEntryValue | null): string | null {
  return typeof token === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(token)
    ? `/coaching/invite/${token}`
    : null;
}

const MESSAGES: Record<string, string> = {
  invite_not_found: "We couldn't find an invite for this account.",
  invite_expired: "This invite has expired. Ask Kamee for a new one.",
  invite_revoked: "This invite was cancelled.",
  wrong_state: "This account is not in the invited state.",
};

export async function acceptInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getCoachSession();
  // Signed out (e.g. the session expired with the page open): back to the
  // invite link, which shows its own sign-in form.
  if (!session.user) redirect(invitePath(formData.get("token")) ?? "/login?next=/coaching");
  // M12 (fix round 1): a coach who already accepted (e.g. this form was
  // still open in a stale tab) should just land back in the hub instead of
  // re-submitting to the RPC.
  if (isHubState(session.status)) redirect("/coaching/onboarding");

  const supabase = await createServerSupabase();
  const token = formData.get("token");
  const { error } = await supabase.rpc("accept_coaching_invite", {
    p_token: typeof token === "string" && token ? token : null,
  });
  if (error) {
    return { message: MESSAGES[error.message] ?? "Could not accept the invite. Please try again." };
  }
  redirect("/coaching/onboarding");
}

/** "Not you? Sign out" on the invite page: sign out and stay on the same invite link. */
export async function signOutFromInvite(formData: FormData): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(invitePath(formData.get("token")) ?? "/login?next=/coaching");
}
