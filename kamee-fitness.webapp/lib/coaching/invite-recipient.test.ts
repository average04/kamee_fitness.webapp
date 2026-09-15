import { describe, expect, it, vi } from "vitest";
import { resolveInviteRecipient } from "./invite-recipient";

function deps() { return {
  find: vi.fn().mockResolvedValue({ candidate: null, capped: false }),
  create: vi.fn().mockResolvedValue("new-id"),
}; }
describe("invite recipient", () => {
  it("rejects invalid input without account operations", async () => {
    const d = deps();
    await expect(resolveInviteRecipient("bad", d)).rejects.toThrow("email");
    expect(d.find).not.toHaveBeenCalled();
  });
  it("reuses an existing identity", async () => {
    const d = deps(); d.find.mockResolvedValue({ candidate: { id: "old-id", role: "user", coach_status: "none" }, capped: false });
    expect(await resolveInviteRecipient("COACH@example.com ", d)).toBe("old-id");
    expect(d.create).not.toHaveBeenCalled();
  });
  it("creates only after an exhaustive lookup", async () => {
    const d = deps(); expect(await resolveInviteRecipient(" Coach@example.com ", d)).toBe("new-id");
    expect(d.create).toHaveBeenCalledWith("coach@example.com");
  });
  it("does not create when the search is capped", async () => {
    const d = deps(); d.find.mockResolvedValue({ candidate: null, capped: true });
    await expect(resolveInviteRecipient("coach@example.com", d)).rejects.toThrow("search");
    expect(d.create).not.toHaveBeenCalled();
  });
  it.each([["admin", "none"], ["coach", "approved"], ["user", "revoked"]])("refuses %s/%s", async (role, coach_status) => {
    const d = deps(); d.find.mockResolvedValue({ candidate: { id: "old-id", role, coach_status }, capped: false });
    await expect(resolveInviteRecipient("coach@example.com", d)).rejects.toThrow();
    expect(d.create).not.toHaveBeenCalled();
  });
});
