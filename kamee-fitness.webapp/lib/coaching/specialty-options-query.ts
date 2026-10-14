import { createServerSupabase } from "@/lib/supabase/server";
import { MAX_SPECIALTY_LENGTH } from "./specialties";

export type CoachingSpecialtyOptions = { options: string[]; error: string | null };

/** A taxonomy failure leaves the rest of the coach's profile editable. */
export async function loadCoachingSpecialtyOptions(): Promise<CoachingSpecialtyOptions> {
  const unavailable = { options: [], error: "Specialty options could not load. Please retry." };
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("coaching_specialty_options");
    if (error || !validOptions(data)) return unavailable;
    return { options: data, error: null };
  } catch {
    return unavailable;
  }
}

function validOptions(data: unknown): data is string[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const seen = new Set<string>();
  for (const option of data) {
    if (typeof option !== "string" || !option.trim() || option.length > MAX_SPECIALTY_LENGTH) return false;
    const key = option.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
