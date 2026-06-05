import Link from "next/link";
import type { Exercise } from "@/lib/admin/exercises";

export function ExerciseTable({ rows }: { rows: Exercise[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No exercises found.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-zinc-400">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Primary muscle</th>
          <th className="py-2 pr-4 font-medium">Equipment</th>
          <th className="py-2 pr-4 font-medium">Image</th>
          <th className="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((ex) => (
          <tr key={ex.id} className="border-b border-zinc-900">
            <td className="py-2 pr-4">{ex.name}</td>
            <td className="py-2 pr-4 text-zinc-400">{ex.primary_muscle}</td>
            <td className="py-2 pr-4 text-zinc-400">
              {ex.is_bodyweight ? "Bodyweight" : ex.equipment.join(", ")}
            </td>
            <td className="py-2 pr-4 text-zinc-400">
              {ex.demo_image_path ? "✓" : "—"}
            </td>
            <td className="py-2 text-right">
              <Link
                href={`/admin/exercises/${ex.id}/edit`}
                className="text-emerald-400 hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
