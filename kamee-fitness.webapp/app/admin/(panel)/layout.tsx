import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/app/admin/actions";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-[#07090a] text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <nav className="flex flex-wrap items-center gap-4" aria-label="Admin navigation">
          <Link href="/admin" className="font-semibold">
            Kamee Admin
          </Link>
          <Link
            href="/admin"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/plans"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Plans
          </Link>
          <Link
            href="/admin/exercises"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Exercises
          </Link>
          <Link
            href="/admin/coaches"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Coaches
          </Link>
          <Link href="/admin/coaching-plans" className="text-sm text-zinc-400 hover:text-zinc-100">Coaching plans</Link>
          <Link href="/admin/coaching-commerce" className="text-sm text-zinc-400 hover:text-zinc-100">Product readiness</Link>
        </nav>
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span className="break-all">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
