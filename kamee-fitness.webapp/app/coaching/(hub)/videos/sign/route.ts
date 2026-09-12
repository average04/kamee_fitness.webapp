import { requireCoach } from "@/lib/coaching/auth";
import { signVideo } from "@/lib/coaching/video-sign";
export async function POST(req: Request) {
  const { user } = await requireCoach();
  const { id } = await req.json();
  if (typeof id !== "string")
    return Response.json({ error: "Invalid video" }, { status: 400 });
  return signVideo(id, user.id);
}
