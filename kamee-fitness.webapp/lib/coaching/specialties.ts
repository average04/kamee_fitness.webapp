export const MAX_SPECIALTIES = 8;
export const MAX_SPECIALTY_LENGTH = 160;

function specialtyKey(value: string): string {
  return value.trim().toLowerCase();
}

export function isSpecialtySelected(selected: readonly string[], specialty: string): boolean {
  const key = specialtyKey(specialty);
  return selected.some((value) => specialtyKey(value) === key);
}

/** Original indices let a coach remove one legacy custom value without rewriting the rest. */
export function customSpecialties(selected: readonly string[], options: readonly string[]) {
  return selected.flatMap((label, index) =>
    isSpecialtySelected(options, label) ? [] : [{ label, index }],
  );
}

export function addSpecialty(
  selected: readonly string[],
  draft: string,
): { ok: true; value: string[] } | { ok: false; error: string } {
  const label = draft.trim();
  if (!label) return { ok: false, error: "Enter a custom specialty." };
  if (label.length > MAX_SPECIALTY_LENGTH) {
    return { ok: false, error: "Use 160 characters or fewer for a specialty." };
  }
  if (isSpecialtySelected(selected, label)) {
    return { ok: false, error: "That specialty is already selected." };
  }
  if (selected.length >= MAX_SPECIALTIES) {
    return { ok: false, error: "Choose up to 8 specialties. Remove one to add another." };
  }
  return { ok: true, value: [...selected, label] };
}

export function toggleSpecialty(selected: readonly string[], specialty: string, checked: boolean): string[] {
  if (!checked) return selected.filter((value) => specialtyKey(value) !== specialtyKey(specialty));
  if (isSpecialtySelected(selected, specialty)) return [...selected];
  const result = addSpecialty(selected, specialty);
  return result.ok ? result.value : [...selected];
}
