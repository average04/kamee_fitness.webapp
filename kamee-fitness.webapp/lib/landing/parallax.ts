/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the user requested reduced motion. SSR-safe (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface PointerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Map a pointer position within `rect` to normalized coords in [-1, 1]. */
export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: PointerRect,
): { x: number; y: number } {
  const x = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  const y = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  return { x, y };
}
