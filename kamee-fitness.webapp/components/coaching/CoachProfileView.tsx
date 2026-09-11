import { buildPublicStorageUrl } from "@/lib/coaching/storage";
import { Pill } from "./ui";

/**
 * Shape returned by the `get_coaching_profile(p_user, p_preview)` RPC.
 * Server component -- no client interactivity needed to render a read-only
 * profile.
 */
export type CoachingProfileJson = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_photo_path: string | null;
  is_verified: boolean;
  headline: string | null;
  about: string | null;
  specialties: string[];
  years_experience: number | null;
  languages: string[];
  location_label: string | null;
  cover_image_path: string | null;
  socials: Record<string, string>;
  is_accepting_clients: boolean;
  response_days: number;
  coach_status: string;
  credentials: {
    id: string;
    title: string;
    issuer: string;
    issued_year: number | null;
    expires_on: string | null;
    position: number;
    verified: boolean;
  }[];
  gallery: { id: string; image_path: string; caption: string | null; position: number }[];
  listings: unknown[];
};

/**
 * Mirrors the app's Coach section IA: cover, headline, about, specialty
 * chips, credentials with a check mark only when verified (leaf/green,
 * never ember -- ember is reserved for the home workout CTA), gallery
 * strip, "Not taking new clients" pill. Image URLs are built from storage
 * paths via `buildPublicStorageUrl`; nothing here renders a raw storage
 * path or a private document path.
 */
export function CoachProfileView({ data }: { data: CoachingProfileJson }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const coverUrl = data.cover_image_path
    ? buildPublicStorageUrl(supabaseUrl, data.cover_image_path)
    : null;
  // Fix round 1: prefer the uploaded photo (a `social-photos` path, same
  // bucket/URL shape as cover/gallery) over `avatar_url`, matching the
  // app's own Avatar component ("uploaded photo path... wins over the
  // bust"/preset). `avatar_url` is a fallback for a coach who hasn't
  // uploaded one.
  const avatarUrl = data.avatar_photo_path
    ? buildPublicStorageUrl(supabaseUrl, data.avatar_photo_path)
    : data.avatar_url;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="relative h-48 w-full bg-ink-900">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">
            No cover photo yet
          </div>
        )}
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full border border-white/10 object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-display text-lg font-semibold text-mist">
                  {data.display_name || data.username || "Coach"}
                </p>
                {/* Fix round 1: the app's profile-level verified seal is
                    its dedicated blue `colors.verified` (#1D9BF0) token,
                    distinct from the leaf/green used for verified
                    credentials below -- sky-500 is the closest existing
                    Tailwind shade. */}
                {data.is_verified && <VerifiedMark tone="blue" />}
              </div>
              {data.location_label && (
                <p className="text-xs text-muted">{data.location_label}</p>
              )}
            </div>
          </div>
          {!data.is_accepting_clients && (
            <Pill className="border-white/10 text-muted">Not taking new clients</Pill>
          )}
        </div>

        {data.headline && <p className="text-sm font-medium text-mist">{data.headline}</p>}

        {data.about && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-mist/80">{data.about}</p>
        )}

        {data.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.specialties.map((s) => (
              <Pill key={s} className="border-leaf-600/30 text-leaf-400">
                {s}
              </Pill>
            ))}
          </div>
        )}

        {data.credentials.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Credentials
            </h2>
            <ul className="space-y-1.5">
              {data.credentials.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm text-mist">
                  {c.verified && <VerifiedMark tone="leaf" />}
                  <span>
                    {c.title} · {c.issuer}
                    {c.issued_year ? ` (${c.issued_year})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.gallery.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Gallery</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.gallery.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={g.id}
                  src={buildPublicStorageUrl(supabaseUrl, g.image_path)}
                  alt={g.caption || "Gallery photo"}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Fix round 1: two tones, one accessible label. `tone="blue"` mirrors the
 * app's dedicated `colors.verified` (#1D9BF0) profile-identity seal;
 * `tone="leaf"` is the credential-row check, which per the design
 * language stays leaf/green (ember is reserved for the home workout CTA).
 * The check icon itself is decorative (`aria-hidden`); the "Verified"
 * text is screen-reader-only rather than only a hover `title`, so it's
 * announced without relying on a mouse.
 */
function VerifiedMark({ tone }: { tone: "blue" | "leaf" }) {
  const bg = tone === "blue" ? "bg-sky-500" : "bg-leaf-600";
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${bg} text-white`}>
      <svg viewBox="0 0 20 20" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
        <path
          d="M4 10.5l3.5 3.5L16 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Verified</span>
    </span>
  );
}
