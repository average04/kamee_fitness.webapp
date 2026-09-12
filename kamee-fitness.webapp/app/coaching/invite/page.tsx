import { InviteCard } from "@/components/coaching/InviteCard";

export const metadata = { title: "Coach invite", robots: { index: false, follow: false } };

/** Opened from the app's invite notification (no token). See InviteCard. */
export default async function InvitePage() {
  return <InviteCard />;
}
