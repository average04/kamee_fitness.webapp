import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, getUserById: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({ createAdminSupabase: () => ({
  from: mocks.from,
  auth: { admin: { getUserById: mocks.getUserById } },
}) }));
import { getInviteIdentity } from "./invite-identity";
const token = "ab".repeat(24);
beforeEach(() => {
  mocks.row = { user_id: "recipient", expires_at: "2099-01-01", revoked_at: null, accepted_at: null };
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: async () => ({ data: mocks.row, error: null }) };
  mocks.from.mockReset().mockReturnValue(query);
  mocks.getUserById.mockReset().mockResolvedValue({ data: { user: { email: "coach@example.com" } }, error: null });
});
describe("invite email lookup", () => {
  it("resolves a valid token to its bound user", async () => {
    expect(await getInviteIdentity(token)).toEqual({ userId: "recipient", email: "coach@example.com" });
    expect(mocks.getUserById).toHaveBeenCalledWith("recipient");
  });
  it("rejects malformed tokens without querying", async () => {
    expect(await getInviteIdentity("bad")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([null, { expires_at: "2000-01-01" }, { revoked_at: "2026-01-01" }, { accepted_at: "2026-01-01" }])("does not disclose unavailable invitations: %j", async (change) => {
    mocks.row = change === null ? null : { ...mocks.row, ...change };
    expect(await getInviteIdentity(token)).toBeNull();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });
});
