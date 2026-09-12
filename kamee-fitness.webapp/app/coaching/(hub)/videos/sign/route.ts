import { requireCoach } from "@/lib/coaching/auth";
import { signVideo } from "@/lib/coaching/video-sign";
export async function POST(req: Request) {
  const { user } = await requireCoach();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string")
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = body;
  return signVideo(id, user.id);
}
