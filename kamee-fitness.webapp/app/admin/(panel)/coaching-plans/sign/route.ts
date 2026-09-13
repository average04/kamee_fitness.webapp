import { requireAdmin } from "@/lib/admin/auth";
import { signVideo } from "@/lib/coaching/video-sign";
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string")
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = body;
  return signVideo(id, null, true);
}
