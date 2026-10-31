import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAutosaveController, type SaveState } from "./autosave";
import { coerceProfileInput, profileFormStateFromRow, profileInputFromFormState, type ProfileFormState, type ProfileInput } from "./profile";
import { addSpecialty } from "./specialties";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("autosaves a new selection and queued unrelated edit without rewriting legacy specialties", async () => {
  const form = profileFormStateFromRow({
    headline: "Coach", about: "", specialties: [" running ", "Strength, balance"],
    years_experience: null, languages: [], location_label: null, socials: {},
    is_accepting_clients: true, response_days: 3,
  });
  const saved: (ProfileInput | null)[] = [];
  const states: SaveState[] = [];
  let release!: () => void;
  const firstRequest = new Promise<void>((resolve) => { release = resolve; });
  const controller = createAutosaveController<ProfileFormState>({
    save: async (input) => {
      saved.push(coerceProfileInput(profileInputFromFormState(input)));
      if (saved.length === 1) await firstRequest;
      return { savedAt: "now" };
    },
    onStateChange: (state) => states.push(state),
  });
  const result = addSpecialty(form.specialties, "  Endurance  ");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  const selected = { ...form, specialties: result.value };
  controller.update(selected);
  await vi.advanceTimersByTimeAsync(799);
  expect(saved).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  controller.saveNow({ ...selected, headline: "Updated coach" });
  release();
  await vi.waitFor(() => expect(controller.hasPending()).toBe(false));
  expect(saved.map((input) => ({ headline: input?.headline, specialties: input?.specialties }))).toEqual([
    { headline: "Coach", specialties: [" running ", "Strength, balance", "Endurance"] },
    { headline: "Updated coach", specialties: [" running ", "Strength, balance", "Endurance"] },
  ]);
  expect(states).toEqual(["saving", "saved", "saving", "saved"]);
});
