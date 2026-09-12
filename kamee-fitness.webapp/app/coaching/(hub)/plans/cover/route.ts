import { requireCoach } from "@/lib/coaching/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { user } = await requireCoach();
  const path = new URL(req.url).searchParams.get("path");
  const db = createAdminSupabase();
  const { data: cover } = await db
    .from("coaching_plan_covers")
    .select("path")
    .eq("path", path ?? "")
    .eq("coach_id", user.id)
    .maybeSingle();
  if (!cover) return new Response(null, { status: 404 });
  const { data, error } = await db.storage
    .from("coaching-plan-covers")
    .createSignedUrl(cover.path, 900);
  if (error || !data) return new Response(null, { status: 503 });
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const { user } = await requireCoach(["approved"]);
  if (Number(req.headers.get("content-length")) > 6 * 1024 * 1024)
    return Response.json(
      { error: "Cover must be at most 5 MB." },
      { status: 400 },
    );
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size < 12)
    return Response.json(
      { error: "Choose a JPG, PNG or WebP up to 5 MB." },
      { status: 400 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png =
    bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const mime = png
    ? "image/png"
    : jpg
      ? "image/jpeg"
      : webp
        ? "image/webp"
        : null;
  if (!mime || mime !== file.type)
    return Response.json(
      { error: "This file is not a supported image." },
      { status: 400 },
    );
  const path = `${user.id}/${crypto.randomUUID()}.${png ? "png" : jpg ? "jpg" : "webp"}`;
  const admin = createAdminSupabase();
  const { error } = await admin.storage
    .from("coaching-plan-covers")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error)
    return Response.json(
      { error: "Cover upload failed. Try again." },
      { status: 500 },
    );
  const { error: rowError } = await admin
    .from("coaching_plan_covers")
    .insert({ path, coach_id: user.id });
  if (rowError) {
    await admin.storage.from("coaching-plan-covers").remove([path]);
    return Response.json({ error: "Could not save cover." }, { status: 500 });
  }
  return Response.json({ path });
}
