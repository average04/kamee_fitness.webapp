import { redirect } from "next/navigation";

/** Keep admin sign-in on the same maintained form as member sign-in. */
export default async function AdminLogin({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const query = new URLSearchParams({ next: "/admin" });
  if (error === "not-authorized" || error === "auth") query.set("error", error);
  redirect(`/login?${query}`);
}
