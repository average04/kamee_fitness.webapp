import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PlanForm } from "@/components/admin/plans/PlanForm";
import { createPlan } from "../actions";

export default async function NewPlanPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/plans" className="hover:text-zinc-300">
          Plans
        </Link>
        <span>/</span>
        <span className="text-zinc-300">New</span>
      </div>
      <h1 className="text-lg font-semibold">New plan</h1>
      <PlanForm action={createPlan} />
    </div>
  );
}
