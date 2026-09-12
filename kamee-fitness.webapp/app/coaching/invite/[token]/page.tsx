import { InviteCard } from "@/components/coaching/InviteCard";

export const metadata = { title: "Coach invite", robots: { index: false, follow: false } };

/** The link in the invite email. See InviteCard. */
export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteCard token={token} />;
}
