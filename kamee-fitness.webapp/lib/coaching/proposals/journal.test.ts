import { describe, expect, it } from "vitest";
import { createProposalJournal } from "./journal";
import { discardConversationPartition } from "../conversation/journal";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = { enrollmentAttemptId: id(1), conversationId: id(2) };
function fixture() {
  const data = new Map<string, string>(), storage = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  const actor = { accountId: id(3), revision: 1, assertCurrent() {} };
  const journal = createProposalJournal({ actor, target, storage });
  const pending = { uncertain: true, mutation: { name: "withdraw" as const, input: { ...target, requestId: id(4), proposalId: id(5), expectedProposalRevision: "0" } } };
  return { actor, data, storage, journal, pending };
}
describe("exact participant proposal recovery", () => {
  it("partitions by account and attempt, freezes nested input and rejects a foreign target", () => {
    const f = fixture(); f.journal.save(f.pending); f.pending.mutation.input.proposalId = id(20);
    expect(f.journal.load()?.mutation.input).toMatchObject({ proposalId: id(5) });
    expect(createProposalJournal({ ...f, actor: { ...f.actor, accountId: id(9) }, target }).load()).toBeNull();
    expect(createProposalJournal({ ...f, target: { ...target, enrollmentAttemptId: id(10) } }).load()).toBeNull();
    expect(() => f.journal.save({ ...f.pending, mutation: { ...f.pending.mutation, input: { ...f.pending.mutation.input, conversationId: id(9) } } })).toThrow();
  });
  it("preserves malformed recovery and refuses coercible array mutation names", () => {
    const f = fixture(); f.journal.save(f.pending); const [key] = f.data.keys();
    const raw = JSON.stringify({ schema: 1, accountId: id(3), uncertain: true, mutation: { name: ["withdraw"], input: f.pending.mutation.input } });
    f.data.set(key, raw); expect(() => f.journal.load()).toThrow(); expect(f.data.get(key)).toBe(raw);
  });
  it("uses the existing verified-owner deletion partition without selecting a switched-in account", async () => {
    const f = fixture(); f.journal.save(f.pending);
    const b = createProposalJournal({ actor: { ...f.actor, accountId: id(9) }, target, storage: f.storage }); b.save(f.pending);
    await discardConversationPartition(id(3), f.storage);
    expect(f.journal.load()).toBeNull(); expect(b.load()?.mutation.input).toMatchObject({ proposalId: id(5) });
    await expect(discardConversationPartition("not-an-owner", f.storage)).rejects.toThrow(); expect(b.load()).not.toBeNull();
  });
});
