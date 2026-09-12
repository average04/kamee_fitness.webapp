import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { isInvitable, isInviteStage, isUuid } from "@/lib/coaching/admin";
import { avatarImageUrl, avatarInitial } from "@/lib/coaching/avatar";
import { MISSING_LABELS } from "@/lib/coaching/profile";
import { buildPublicStorageUrl } from "@/lib/coaching/storage";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { DecisionForm } from "@/components/admin/coaching/DecisionForm";
import { fmtDate, fmtDateTime } from "@/components/admin/coaching/format";
import { InviteBlock } from "@/components/admin/coaching/InviteBlock";
import { REVIEW_DECISION_LABEL, StatusPill } from "@/components/admin/coaching/status";
import { StatusActionButton } from "@/components/admin/coaching/StatusActionButton";
import { VerifyCredentialButton } from "@/components/admin/coaching/VerifyCredentialButton";
import { loadCoachDetail } from "../queries";

const CHECKLIST_KEYS = Object.keys(MISSING_LABELS).filter((k) => k !== "profile");
const DOCUMENT_SIGNED_URL_TTL_SECONDS = 300;

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

  const { profile, coaching, credentials, gallery, reviews, invite, missing } = detail;
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
  // render, never stored or logged. M2 (fix round 1): distinguish "no
  // document" from "has a document but signing it failed" -- the latter
  // shows "Unavailable" and disables Verify, instead of both cases reading
  // as an identical, misleading "None".
  const db = createAdminSupabase();
  const credentialsWithUrls = await Promise.all(
    credentials.map(async (c) => {
      if (!c.document_path) {
        return { ...c, documentUrl: null as string | null, documentUnavailable: false };
      }
      const { data } = await db.storage
        .from("coaching-documents")
        .createSignedUrl(c.document_path, DOCUMENT_SIGNED_URL_TTL_SECONDS);
      return {
        ...c,
        documentUrl: data?.signedUrl ?? null,
        documentUnavailable: !data?.signedUrl,
      };
    }),
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Same rule as the coach-facing CoachProfileView: only the uploaded photo
  // (a `social-photos` path) is an image. `avatar_url` is a preset id, not
  // a URL, and never satisfies the completeness "avatar" item.
  const avatarUrl = avatarImageUrl(profile.avatar_photo_path, supabaseUrl);
  const coverUrl = coaching?.cover_image_path
    ? buildPublicStorageUrl(supabaseUrl, coaching.cover_image_path)
    : null;
  const coachName = profile.display_name ?? profile.username ?? "Coach";
  const isAdminTarget = profile.role === "admin";
  const canInvite = isInvitable(profile.role, status);
  const inviteStage = isInviteStage(status);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{coachName}</h1>
          {profile.username && (
            <p className="text-sm text-zinc-500">@{profile.username}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            role: {profile.role}
          </span>
          <StatusPill status={status} />
        </div>
      </div>

      {(inviteStage || invite) && (
        <section className="space-y-3 rounded-xl border border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-300">Invite</h2>
          {/* M8 (fix round 1): show the latest invite's full history, not just after a fresh send. */}
          {invite && (
            <p className="text-xs text-zinc-500">
              Invited {fmtDateTime(invite.created_at)} · expires {fmtDateTime(invite.expires_at)}{" "}
              · accepted {invite.accepted_at ? fmtDateTime(invite.accepted_at) : "not yet"} ·
              revoked {invite.revoked_at ? fmtDateTime(invite.revoked_at) : "no"}
            </p>
          )}
          {canInvite && (
            <InviteBlock
              userId={profile.id}
              label={status === "invited" ? "Resend" : "Invite"}
            />
          )}
          {isAdminTarget && inviteStage && (
            <p className="text-xs text-zinc-500">
              Admins cannot be coaches. Use a separate non-admin account to coach.
            </p>
          )}
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

        {/* I2 (fix round 1): the reviewer previously had no way to see the cover photo or avatar the app will actually show. */}
        <div className="mb-4 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset next/image can optimize
            <img
              src={avatarUrl}
              alt={`${coachName} avatar`}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-500"
              role="img"
              aria-label="No profile photo uploaded"
            >
              {avatarInitial(coachName)}
            </div>
          )}
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset next/image can optimize
            <img
              src={coverUrl}
              alt={`${coachName} cover photo`}
              className="h-16 w-32 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500"
              aria-label="No cover photo set"
            >
              No cover
            </div>
          )}
        </div>

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
              <dd className="text-zinc-200">
                {coaching.terms_accepted_at
                  ? `${fmtDateTime(coaching.terms_accepted_at)} · version ${coaching.terms_version ?? "unversioned (re-acceptance needed)"}`
                  : fmtDateTime(coaching.terms_accepted_at)}
              </dd>
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
                    ) : c.documentUnavailable ? (
                      <span className="text-amber-500">Unavailable</span>
                    ) : (
                      <span className="text-zinc-600">None</span>
                    )}
                  </td>
                  <td className="py-2">
                    <VerifyCredentialButton
                      id={c.id}
                      initialVerified={c.is_verified}
                      expected={{
                        documentPath: c.document_path,
                        title: c.title,
                        issuer: c.issuer,
                        issuedYear: c.issued_year,
                        expiresOn: c.expires_on,
                      }}
                      disabledReason={
                        c.documentUnavailable
                          ? "Document link unavailable — reload the page"
                          : undefined
                      }
                    />
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
                  <span className="font-medium text-zinc-200">
                    {REVIEW_DECISION_LABEL[r.decision] ?? r.decision}
                  </span>
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
