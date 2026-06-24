"use server";

import { headers } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { isValidEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type DeletionRequestResult = { ok: true } | { ok: false; error: string };

export async function submitDeletionRequest(
  _prev: DeletionRequestResult | null,
  formData: FormData,
): Promise<DeletionRequestResult> {
  // Bound inputs server-side — this is an anonymous, unauthenticated endpoint.
  const email = String(formData.get("email") ?? "")
    .trim()
    .slice(0, 320)
    .toLowerCase();
  const rawNote = String(formData.get("note") ?? "").trim();
  const note = rawNote ? rawNote.slice(0, 1000) : null;
  const token = String(formData.get("cf-turnstile-response") ?? "") || null;

  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const ip = clientIp(await headers());
  const { ok: allowed } = await rateLimit({
    name: "deletion-request",
    key: ip,
    max: 3,
    windowSec: 3600,
  });
  if (!allowed) {
    return { ok: false, error: "Too many requests. Please try again later." };
  }

  if (!(await verifyTurnstile(token, ip))) {
    return { ok: false, error: "Human verification failed — please retry." };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("web_deletion_requests")
    .insert({ email, note });
  if (error) return { ok: false, error: "Something went wrong. Try again." };

  return { ok: true };
}
