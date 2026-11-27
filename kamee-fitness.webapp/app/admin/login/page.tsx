import { redirect } from "next/navigation";
import { getVerifiedPortalUser } from "@/lib/auth/portal-session";
import { getSignInDestination } from "@/lib/auth/landing";
import { safePortalNext } from "@/lib/auth/portal-access";

/** Keep admin sign-in on the same maintained form as member sign-in. */
export default async function AdminLogin({ searchParams }: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const continuation = safePortalNext(next, "https://kamee.fit") ?? "/admin";
  if (await getVerifiedPortalUser()) redirect(await getSignInDestination(continuation));
  const query = new URLSearchParams({ next: continuation });
  if (error === "auth") query.set("error", error);
  redirect(`/login?${query}`);
}
