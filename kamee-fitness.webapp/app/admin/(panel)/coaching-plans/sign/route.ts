import { requireAdmin } from "@/lib/admin/auth";
import { signVideo } from "@/lib/coaching/video-sign";
export async function POST(req: Request) {
  await requireAdmin();
  const { id } = await req.json();
  if (typeof id !== "string")
    return Response.json({ error: "Invalid video" }, { status: 400 });
  return signVideo(id, null, true);
}
