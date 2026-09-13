import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
export async function GET(req: Request) {
  await requireAdmin();
  const db = createAdminSupabase();
  const { data: plan } = await db
    .from("plans")
    .select("cover_image_path")
    .eq("id", new URL(req.url).searchParams.get("plan") ?? "")
    .eq("kind", "coach")
    .maybeSingle();
  if (!plan?.cover_image_path) return new Response(null, { status: 404 });
  const { data, error } = await db.storage
    .from("coaching-plan-covers")
    .createSignedUrl(plan.cover_image_path, 900);
  if (error || !data) return new Response(null, { status: 503 });
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "no-store" },
  });
}
