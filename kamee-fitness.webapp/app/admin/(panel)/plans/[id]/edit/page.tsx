import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { PlanForm } from "@/components/admin/plans/PlanForm";
import { getPlan } from "../../queries";
import { updatePlan } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/plans" className="hover:text-zinc-300">
          Plans
        </Link>
        <span>/</span>
        <Link href={`/admin/plans/${plan.id}`} className="hover:text-zinc-300">
          {plan.title}
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Edit</span>
      </div>
      <h1 className="text-lg font-semibold">Edit plan</h1>
      <PlanForm action={updatePlan} plan={plan} />
    </div>
  );
}
