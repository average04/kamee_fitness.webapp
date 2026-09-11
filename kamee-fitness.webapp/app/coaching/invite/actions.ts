"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { FormState } from "@/lib/coaching/profile";

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
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/coaching/invite");
  const token = formData.get("token");
  const { error } = await supabase.rpc("accept_coaching_invite", {
    p_token: typeof token === "string" && token ? token : null,
  });
  if (error) {
    return { message: MESSAGES[error.message] ?? "Could not accept the invite. Please try again." };
  }
  redirect("/coaching/onboarding");
}
