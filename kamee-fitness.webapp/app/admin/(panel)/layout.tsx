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
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <nav className="flex items-center gap-4">
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
        </nav>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{user.email}</span>
          <form action={signOut}>
            <button className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
