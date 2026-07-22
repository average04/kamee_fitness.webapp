import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  DISCIPLINE_LABELS,
  DISCIPLINES,
  PLAN_COLUMNS,
  planAppUrl,
  planCoverUrl,
  planWebUrl,
  type PlanRow,
} from "@/lib/public-plans";

/**
 * Partner API: the published training-plan catalog. Read-only, keyed by the
 * X-Api-Key header (PLANS_API_KEY), CDN-cached per API key + discipline.
 * Anon RLS on `plans` (published + approved only) is the second safety net
 * behind the explicit filters below.
 */

/** Shared response headers; CORS only when a partner origin is configured. */
function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  const origin = process.env.PLANS_ALLOWED_ORIGIN;
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function errorJson(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...baseHeaders(), "Cache-Control": "no-store" } },
  );
}

/** Constant-time comparison; hashing first sidesteps input-length leaks. */
function apiKeyMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function GET(request: NextRequest) {
  const expectedKey = process.env.PLANS_API_KEY;
  if (!expectedKey) {
    console.error("plans api: PLANS_API_KEY is not configured");
    return errorJson(500, "Server error.");
  }
  if (!apiKeyMatches(request.headers.get("x-api-key"), expectedKey)) {
    return errorJson(401, "Unauthorized.");
  }

  const discipline = request.nextUrl.searchParams.get("discipline");
  if (
    discipline !== null &&
    !(DISCIPLINES as readonly string[]).includes(discipline)
  ) {
    return errorJson(400, "Invalid discipline. Use 'strength' or 'running'.");
  }

  try {
    const supabase = createSupabaseServerClient();
    // Explicit filters mirror the anon RLS policy (defense in depth).
    let query = supabase
      .from("plans")
      .select(PLAN_COLUMNS)
      .eq("is_published", true)
      .eq("review_status", "approved")
      .order("discipline", { ascending: true })
      .order("title", { ascending: true });
    if (discipline) query = query.eq("discipline", discipline);

    const { data, error } = await query;
    if (error) {
      console.error("plans api: query failed:", error.message);
      return errorJson(500, "Server error.");
    }

    const plans = ((data ?? []) as PlanRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      coverUrl: planCoverUrl(row.cover_image_path),
      level: row.level ?? "none",
      discipline: row.discipline,
      disciplineLabel: DISCIPLINE_LABELS[row.discipline],
      weeksCount: row.weeks_count,
      daysPerWeek: row.days_per_week,
      estMinutesPerSession: row.est_minutes_per_session,
      webUrl: planWebUrl(row.id),
      appUrl: planAppUrl(row.id),
    }));

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), plans },
      {
        headers: {
          ...baseHeaders(),
          // Modest browser cache; the long CDN cache is the cost/DDoS defense.
          "Cache-Control": "public, max-age=300",
          "Netlify-CDN-Cache-Control":
            "public, durable, s-maxage=3600, stale-while-revalidate=86400",
          // Cache key = discipline param + API key: junk params can't bust
          // the cache, and callers without the key never see a cached 200.
          "Netlify-Vary": "query=discipline,header=x-api-key",
          // Netlify-Vary only guards Netlify's edge; the standard Vary keeps
          // downstream RFC-9111 shared caches keyed on the API key too.
          Vary: "X-Api-Key",
        },
      },
    );
  } catch (err) {
    console.error("plans api: unexpected failure:", err);
    return errorJson(500, "Server error.");
  }
}

export function OPTIONS() {
  const headers: Record<string, string> = {};
  const origin = process.env.PLANS_ALLOWED_ORIGIN;
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "X-Api-Key";
  }
  return new NextResponse(null, { status: 204, headers });
}

// Next would 405 unexported methods itself, but without the JSON body and
// no-store header this API promises — so gate them explicitly.
const methodNotAllowed = () => errorJson(405, "Method not allowed.");
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
