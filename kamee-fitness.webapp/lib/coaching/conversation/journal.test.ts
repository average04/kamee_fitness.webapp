import { describe, expect, it } from "vitest";
import { discardConversationPartition, createSessionConversationJournal } from "./journal";
const A = "00000000-0000-4000-8000-000000000001", B = "00000000-0000-4000-8000-000000000002", attempt = "00000000-0000-4000-8000-000000000003";
function memory() { const data = new Map<string, string>(); return { data, get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
  getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } }; }
describe("per-tab conversation recovery", () => {
  it("recovers owner/attempt drafts across adapter recreation without copying another owner", async () => {
    const storage = memory(); const a = { accountId: A, revision: 1, assertCurrent() {} };
    await createSessionConversationJournal(storage).bind(a).saveDraft(attempt, "  exact\ntext");
    expect((await createSessionConversationJournal(storage).bind(a).read(attempt)).draft).toBe("  exact\ntext");
    expect((await createSessionConversationJournal(storage).bind({ ...a, accountId: B }).read(attempt)).draft).toBe("");
  });
  it("scheduled deletion discards only the server-returned owner and allows a later fresh session", async () => {
    const storage = memory(); const journal = createSessionConversationJournal(storage);
    const actor = { accountId: A, revision: 1, assertCurrent() {} };
    await journal.bind(actor).saveDraft(attempt, "A draft"); await journal.bind({ ...actor, accountId: B }).saveDraft(attempt, "B draft");
    await discardConversationPartition(A, storage);
    expect((await journal.bind({ ...actor, accountId: B }).read(attempt)).draft).toBe("B draft");
    await journal.bind(actor).saveDraft(attempt, "Fresh A session");
    expect((await journal.bind(actor).read(attempt)).draft).toBe("Fresh A session");
  });
});
