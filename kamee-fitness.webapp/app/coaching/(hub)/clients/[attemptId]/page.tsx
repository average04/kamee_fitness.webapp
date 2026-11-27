import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/coaching/auth";
import { COACHING_CONVERSATIONS_ENABLED, conversationAttempt } from "@/lib/coaching/conversation/flags";
import { CoachConversation } from "@/components/coaching/conversation/CoachConversation";

export const metadata = { title: "Coaching conversation" };
export default async function CoachConversationPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireCoach();
  const attemptId = conversationAttempt((await params).attemptId);
  if (!COACHING_CONVERSATIONS_ENABLED || !attemptId) notFound();
  return <CoachConversation accountId={user.id} attemptId={attemptId} />;
}
