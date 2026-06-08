import Link from "next/link";
import type { Plan, ReviewStatus } from "@/lib/admin/plans";

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const coverUrl = (path: string | null) =>
  path && base ? `${base}/storage/v1/object/public/${path}` : null;

const price = (cents: number, currency: string) =>
  cents === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        cents / 100,
      );

const REVIEW_TONE: Record<ReviewStatus, string> = {
  draft: "text-zinc-400 border-zinc-700",
  in_review: "text-amber-300 border-amber-800",
  approved: "text-emerald-300 border-emerald-800",
  rejected: "text-red-300 border-red-900",
};

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

export function PlanTable({ rows }: { rows: Plan[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No plans match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Level</th>
            <th className="px-3 py-2 font-medium">Weeks</th>
            <th className="px-3 py-2 font-medium">Equipment</th>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((p) => {
            const url = coverUrl(p.cover_image_path);
            return (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/plans/${p.id}`}
                    className="flex items-center gap-3"
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 object-cover"
                      />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-900" />
                    )}
                    <span className="font-medium text-zinc-100 hover:text-emerald-400">
                      {p.is_default && (
                        <span className="mr-1 text-amber-400" title="Default plan">
                          ★
                        </span>
                      )}
                      {p.title}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-400">{p.kind}</td>
                <td className="px-3 py-2 text-zinc-400">{p.level}</td>
                <td className="px-3 py-2 text-zinc-400">{p.weeks_count}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {p.equipment_tier.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {price(p.price_cents, p.currency)}
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {p.is_published ? (
                      <Badge className="border-emerald-800 text-emerald-300">
                        published
                      </Badge>
                    ) : (
                      <Badge className="border-zinc-700 text-zinc-500">
                        draft
                      </Badge>
                    )}
                    <Badge className={REVIEW_TONE[p.review_status]}>
                      {p.review_status.replace(/_/g, " ")}
                    </Badge>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
