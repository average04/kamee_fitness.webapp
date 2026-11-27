import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ owner: "00000000-0000-4000-8000-000000000001", signedOut: false, written: "", error: false }));
vi.mock("next/cache", () => ({ revalidatePath() {} }));
vi.mock("next/navigation", () => ({ redirect() { throw Error("redirect"); } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: f.owner } } }), signOut: async () => { f.signedOut = true; } },
  from: () => ({ upsert: async (row: { user_id: string }) => { f.written = row.user_id; f.owner = "00000000-0000-4000-8000-000000000002"; return { error: f.error ? Error("failed") : null }; },
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { purge_after: "2026-11-30T00:00:00Z" } }) }) }) }),
}) }));
import { requestAccountDeletion } from "@/app/delete-account/actions";
beforeEach(() => { f.owner = "00000000-0000-4000-8000-000000000001"; f.signedOut = false; f.written = ""; f.error = false; });
describe("scheduled deletion local cleanup identity", () => {
  it("returns the server-captured owner despite a subsequent account switch", async () => {
    const form = new FormData(); form.set("confirm", "DELETE");
    expect(await requestAccountDeletion(null, form)).toEqual({ ok: true, purgeAfter: "2026-11-30T00:00:00Z", cleanupAccountId: "00000000-0000-4000-8000-000000000001" });
    expect(f.written).toBe("00000000-0000-4000-8000-000000000001"); expect(f.signedOut).toBe(true);
  });
  it("does not return cleanup authorization when scheduling fails", async () => {
    f.error = true; const form = new FormData(); form.set("confirm", "DELETE");
    expect(await requestAccountDeletion(null, form)).toMatchObject({ ok: false }); expect(f.signedOut).toBe(false);
  });
});
