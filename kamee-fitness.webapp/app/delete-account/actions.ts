"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export type DeletionRequestResult = { ok: true } | { ok: false; error: string };

export async function submitDeletionRequest(
  _prev: DeletionRequestResult | null,
  formData: FormData,
): Promise<DeletionRequestResult> {
  const email = String(formData.get("email") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const token = String(formData.get("cf-turnstile-response") ?? "") || null;

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!(await verifyTurnstile(token))) {
    return { ok: false, error: "Human verification failed — please retry." };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("web_deletion_requests")
    .insert({ email, note });
  if (error) return { ok: false, error: "Something went wrong. Try again." };

  return { ok: true };
}
