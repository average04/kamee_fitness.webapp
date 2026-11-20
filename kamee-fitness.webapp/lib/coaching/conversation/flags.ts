/** Next config bakes a sanitized, build-consistent Preview-only exposure. */
export const COACHING_CONVERSATIONS_ENABLED = process.env.NEXT_PUBLIC_COACHING_EXPOSURE === "preview";

export function conversationAttempt(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}
