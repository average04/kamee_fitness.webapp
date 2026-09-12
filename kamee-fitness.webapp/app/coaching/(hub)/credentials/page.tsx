import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CredentialsManager, type CredentialRow } from "@/components/coaching/CredentialsManager";
import { BackLink } from "@/components/coaching/BackLink";

export const metadata = { title: "Coach credentials" };

export default async function CredentialsPage() {
  const { user, status } = await requireCoach();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_credentials")
    .select("id, title, issuer, issued_year, expires_on, document_path, is_verified, verified_at")
    .eq("coach_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  // M8-style rule (see loadHub): never silently render an empty list on a
  // failed read -- app/coaching/error.tsx shows a friendly retry instead.
  if (error) {
    throw new Error(`CredentialsPage: failed to load coaching_credentials: ${error.message}`);
  }

  const readOnly = status === "in_review";

  return (
    <div className="space-y-6">
      <BackLink status={status} />
      <h1 className="font-display text-2xl font-semibold">Credentials</h1>
      <p className="text-sm text-muted">
        Optional. Add certifications, licenses, or other evidence members can trust, if you have
        them. Documents are private and reviewed by Kamee staff -- never shown publicly.
      </p>
      <CredentialsManager
        coachId={user.id}
        credentials={(data ?? []) as CredentialRow[]}
        readOnly={readOnly}
      />
    </div>
  );
}
