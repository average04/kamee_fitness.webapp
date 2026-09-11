import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { isUuid } from "@/lib/coaching/admin";
import { MISSING_LABELS } from "@/lib/coaching/profile";
import { buildPublicStorageUrl } from "@/lib/coaching/storage";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { DecisionForm } from "@/components/admin/coaching/DecisionForm";
import { InviteBlock } from "@/components/admin/coaching/InviteBlock";
import { StatusActionButton } from "@/components/admin/coaching/StatusActionButton";
import { VerifyCredentialButton } from "@/components/admin/coaching/VerifyCredentialButton";
import { loadCoachDetail } from "../queries";

const CHECKLIST_KEYS = Object.keys(MISSING_LABELS).filter((k) => k !== "profile");
const INVITABLE_STATUSES = new Set(["none", "pending", "rejected", "invited"]);
const DOCUMENT_SIGNED_URL_TTL_SECONDS = 300;

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const detail = await loadCoachDetail(id);
  if (!detail.profile) notFound();

  const { profile, coaching, credentials, gallery, reviews, missing } = detail;
  const status = profile.coach_status;

  // Treat the RPC's "profile" meta-key as "every item missing" (same
  // convention as the coach-facing Checklist component) rather than letting
  // the absence of the other 7 literal keys read as "7 of 7 complete".
  const missingSet = new Set(missing);
  const allMissing = missingSet.has("profile");
  const doneCount = allMissing
    ? 0
    : CHECKLIST_KEYS.filter((k) => !missingSet.has(k)).length;
  const canApprove = !allMissing && missing.length === 0;

  // "View document" links are 5-minute signed URLs generated server-side at
  // render, never stored or logged.
  const db = createAdminSupabase();
  const credentialsWithUrls = await Promise.all(
    credentials.map(async (c) => {
      if (!c.document_path) return { ...c, documentUrl: null as string | null };
      const { data } = await db.storage
        .from("coaching-documents")
        .createSignedUrl(c.document_path, DOCUMENT_SIGNED_URL_TTL_SECONDS);
      return { ...c, documentUrl: data?.signedUrl ?? null };
    }),
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {profile.display_name ?? profile.username ?? profile.id}
          </h1>
          {profile.username && (
            <p className="text-sm text-zinc-500">@{profile.username}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            role: {profile.role}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {status}
          </span>
        </div>
      </div>

      {INVITABLE_STATUSES.has(status) && (
        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            {status === "invited" ? "Resend invite" : "Invite to coach"}
          </h2>
          <InviteBlock userId={profile.id} label={status === "invited" ? "Resend" : "Invite"} />
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          Profile completeness — {doneCount} of {CHECKLIST_KEYS.length}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {CHECKLIST_KEYS.map((key) => {
            const done = !allMissing && !missingSet.has(key);
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span
                  className={done ? "text-emerald-500" : "text-zinc-600"}
                  aria-hidden="true"
                >
                  {done ? "✓" : "○"}
                </span>
                <span className={done ? "text-zinc-500 line-through" : "text-zinc-300"}>
                  {MISSING_LABELS[key]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Profile summary</h2>
        {coaching ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Headline</dt>
              <dd className="text-zinc-200">{coaching.headline || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Location</dt>
              <dd className="text-zinc-200">{coaching.location_label || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">About</dt>
              <dd className="whitespace-pre-wrap text-zinc-200">{coaching.about || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Specialties</dt>
              <dd className="text-zinc-200">
                {coaching.specialties.length ? coaching.specialties.join(", ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Languages</dt>
              <dd className="text-zinc-200">
                {coaching.languages.length ? coaching.languages.join(", ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Years experience</dt>
              <dd className="text-zinc-200">{coaching.years_experience ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Response time</dt>
              <dd className="text-zinc-200">{coaching.response_days} day(s)</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Accepting clients</dt>
              <dd className="text-zinc-200">{coaching.is_accepting_clients ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Terms accepted</dt>
              <dd className="text-zinc-200">{fmtDate(coaching.terms_accepted_at)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Instagram</dt>
              <dd className="text-zinc-200">{coaching.socials?.instagram || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Website</dt>
              <dd className="text-zinc-200">{coaching.socials?.website || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">This coach has not started a profile yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Credentials <span className="text-zinc-500">({credentialsWithUrls.length})</span>
        </h2>
        {credentialsWithUrls.length === 0 ? (
          <p className="text-sm text-zinc-500">No credentials submitted.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Issuer</th>
                <th className="py-2 pr-4 font-medium">Issued</th>
                <th className="py-2 pr-4 font-medium">Expires</th>
                <th className="py-2 pr-4 font-medium">Document</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {credentialsWithUrls.map((c) => (
                <tr key={c.id} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-200">{c.title}</td>
                  <td className="py-2 pr-4 text-zinc-400">{c.issuer}</td>
                  <td className="py-2 pr-4 text-zinc-400">{c.issued_year ?? "—"}</td>
                  <td className="py-2 pr-4 text-zinc-400">{c.expires_on ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {c.documentUrl ? (
                      <a
                        href={c.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        View document
                      </a>
                    ) : (
                      <span className="text-zinc-600">None</span>
                    )}
                  </td>
                  <td className="py-2">
                    <VerifyCredentialButton id={c.id} initialVerified={c.is_verified} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Gallery <span className="text-zinc-500">({gallery.length})</span>
        </h2>
        {gallery.length === 0 ? (
          <p className="text-sm text-zinc-500">No gallery photos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((g) => (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset next/image can optimize
              <img
                key={g.id}
                src={buildPublicStorageUrl(supabaseUrl, g.image_path)}
                alt={g.caption ?? "Coach gallery photo"}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Review history</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">No review decisions yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{r.decision}</span>
                  <span className="text-xs text-zinc-500">{fmtDate(r.created_at)}</span>
                </div>
                {r.note && <p className="mt-1 text-zinc-400">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {status === "in_review" && (
        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Review decision</h2>
          <DecisionForm userId={profile.id} canApprove={canApprove} />
        </section>
      )}

      {status !== "none" && status !== "revoked" && (
        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Status</h2>
          <div className="flex flex-wrap gap-2">
            {status === "approved" && (
              <StatusActionButton userId={profile.id} status="suspended" />
            )}
            {status === "suspended" && (
              <StatusActionButton userId={profile.id} status="approved" />
            )}
            {/* This whole section is already gated on status !== "none" && status !== "revoked" above, so revoke (allowed from any other status per admin_set_coach_status) always applies here. */}
            <StatusActionButton userId={profile.id} status="revoked" />
          </div>
        </section>
      )}
    </div>
  );
}
