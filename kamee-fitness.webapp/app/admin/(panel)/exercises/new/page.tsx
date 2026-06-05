import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { createExercise } from "../actions";
import { getDistinctMuscles } from "../queries";

export default async function NewExercisePage() {
  await requireAdmin();
  const muscles = await getDistinctMuscles();
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">New exercise</h1>
      <ExerciseForm action={createExercise} muscles={muscles} />
    </div>
  );
}
