import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { DeleteExerciseForm } from "@/components/admin/DeleteExerciseForm";
import { deleteExercise, updateExercise } from "../../actions";
import { getDistinctMuscles, getExercise } from "../../queries";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [exercise, muscles] = await Promise.all([
    getExercise(id),
    getDistinctMuscles(),
  ]);
  if (!exercise) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit: {exercise.name}</h1>
        <DeleteExerciseForm id={exercise.id} action={deleteExercise} />
      </div>
      <ExerciseForm
        action={updateExercise}
        exercise={exercise}
        muscles={muscles}
      />
    </div>
  );
}
