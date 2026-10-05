"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isDeleteConfirmation } from "@/lib/account-deletion";

/**
 * Web account deletion (security audit 2026-10-05, M2).
 *
 * The old form queued ANY email address with no proof that the requester owned
 * it, leaving the operator as the only safeguard against deleting someone
 * else's account. Deletion now requires signing in with a one-time code sent to
 * the account's own address (EmailCodeSignIn, existing accounts only), and the
 * request is the same 30-day, cancellable `account_deletion_requests` row the
 * app writes. Every call below runs as the signed-in user: RLS limits it to the
 * caller's own row, and the daily purge job does the rest.
 */

export type DeletionActionState =
  | { ok: true; purgeAfter: string | null }
  | { ok: false; error: string }
  | null;

const EXPIRED = "Your sign-in expired. Sign in again to continue.";

export async function requestAccountDeletion(
  _prev: DeletionActionState,
  formData: FormData,
): Promise<DeletionActionState> {
  if (!isDeleteConfirmation(formData.get("confirm"))) {
    return { ok: false, error: "Type DELETE to confirm." };
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: EXPIRED };

  // Same idempotent upsert as the app (src/api/accountDeletion.ts): an existing
  // request keeps its original purge date.
  const { error } = await supabase
    .from("account_deletion_requests")
    .upsert({ user_id: user.id, source: "web" }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Something went wrong. Please try again." };

  const { data } = await supabase
    .from("account_deletion_requests")
    .select("purge_after")
    .eq("user_id", user.id)
    .maybeSingle();

  // Mirror the app: scheduling deletion signs the user out; signing back in
  // before the purge date is how they cancel.
  await supabase.auth.signOut();
  revalidatePath("/delete-account");
  return { ok: true, purgeAfter: (data?.purge_after as string | undefined) ?? null };
}

export async function cancelAccountDeletion(): Promise<DeletionActionState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: EXPIRED };
  const { error } = await supabase.from("account_deletion_requests").delete().eq("user_id", user.id);
  if (error) {
    // account_deletion_requests_guard_claimed_cancel: storage cleanup has
    // already started, so the account can no longer be restored.
    return {
      ok: false,
      error: "This deletion is already in progress and can't be cancelled. Contact support@kamee.fit.",
    };
  }
  revalidatePath("/delete-account");
  redirect("/delete-account");
}

export async function signOutFromDeletion(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/delete-account");
}
