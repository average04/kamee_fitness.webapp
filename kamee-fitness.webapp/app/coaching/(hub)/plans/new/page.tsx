import { PageIntro } from "@/components/coaching/PageIntro";
import { CreatePlan } from "@/components/coaching/plans/CreatePlan";
import { requireCoach } from "@/lib/coaching/auth";

export const metadata = { title: "Create coaching plan" };

export default async function NewPlanPage() {
  const { status } = await requireCoach();
  if (status !== "approved")
    return (
      <PageIntro
        title="Create plan"
        description="You can create plans once your coach profile is approved."
      />
    );

  return (
    <>
      <PageIntro
        title="Create plan"
        description="Start with a title and plan type."
      />
      <div className="coach-create-plan">
        <CreatePlan />
      </div>
    </>
  );
}
