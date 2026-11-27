import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/coaching/auth";

export default async function CoachingIndexPage() {
  const { status } = await requireCoach();
  redirect(status === "approved" ? "/coaching/dashboard" : "/coaching/profile");
}
