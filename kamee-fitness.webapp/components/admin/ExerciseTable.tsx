import Link from "next/link";
import type { Exercise } from "@/lib/admin/exercises";
import { VideoUrlCell } from "./VideoUrlCell";
import { VerifiedCheckbox } from "./VerifiedCheckbox";

// Demo images live in the public `exercise-demos` bucket; demo_image_path is
// stored bucket-prefixed (e.g. "exercise-demos/bench-press.png").
function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`;
}

export function ExerciseTable({
  rows,
  onSaveVideo,
  onToggleVerified,
}: {
  rows: Exercise[];
  onSaveVideo: (
    id: string,
    url: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onToggleVerified: (
    id: string,
    verified: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No exercises found.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-zinc-400">
          <th className="py-2 pr-3 font-medium">Verified</th>
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Primary muscle</th>
          <th className="py-2 pr-4 font-medium">Equipment</th>
          <th className="py-2 pr-4 font-medium">Image</th>
          <th className="py-2 pr-4 font-medium">YouTube</th>
          <th className="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((ex) => (
          <tr key={ex.id} className="border-b border-zinc-900">
            <td className="py-2 pr-3">
              <VerifiedCheckbox
                id={ex.id}
                name={ex.name}
                initialVerified={ex.verified}
                onToggle={onToggleVerified}
              />
            </td>
            <td className="py-2 pr-4">{ex.name}</td>
            <td className="py-2 pr-4 text-zinc-400">{ex.primary_muscle}</td>
            <td className="py-2 pr-4 text-zinc-400">
              {ex.is_bodyweight ? "Bodyweight" : ex.equipment.join(", ")}
            </td>
            <td className="py-2 pr-4">
              {ex.demo_image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(ex.demo_image_path)}
                  alt={ex.name}
                  loading="lazy"
                  className="h-16 w-16 rounded border border-zinc-800 object-cover"
                />
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </td>
            <td className="py-2 pr-4">
              <VideoUrlCell
                id={ex.id}
                initialUrl={ex.demo_video_path}
                onSave={onSaveVideo}
              />
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
