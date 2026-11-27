import { redirect } from "next/navigation";
import { getSignInDestination } from "@/lib/auth/landing";

export default async function SignInLanding({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(await getSignInDestination(next));
}
