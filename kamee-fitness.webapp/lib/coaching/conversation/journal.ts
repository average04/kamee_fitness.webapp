import { CONVERSATION_JOURNAL_ROOT, createConversationJournalManager } from "./generated/conversationJournalCore";
import { conversationAttempt } from "./flags";

type TabStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
const tails = new WeakMap<TabStorage, Map<string, Promise<unknown>>>();
function serial<T>(storage: TabStorage, owner: string, work: () => Promise<T>): Promise<T> {
  let owners = tails.get(storage); if (!owners) tails.set(storage, owners = new Map());
  const result = (owners.get(owner) ?? Promise.resolve()).catch(() => {}).then(work);
  owners.set(owner, result); void result.finally(() => { if (owners!.get(owner) === result) owners!.delete(owner); }).catch(() => {});
  return result;
}
function keys(storage: TabStorage) { return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key !== null); }

/** sessionStorage preserves refresh recovery in this tab only. No transcript/context/token is stored. */
export function createSessionConversationJournal(storage: TabStorage = window.sessionStorage) {
  return createConversationJournalManager({
    storage: { getItem: async key => storage.getItem(key), setItem: async (key, value) => { storage.setItem(key, value); },
      removeItem: async key => { storage.removeItem(key); }, getAllKeys: async () => keys(storage) },
    restoreFence: async () => {}, runWrite: (owner, work) => serial(storage, owner, work),
  });
}

/** Scheduling deletion is reversible: remove this tab's copies without a permanent erasure fence. */
export async function discardConversationPartition(cleanupAccountId: string, storage: TabStorage = window.sessionStorage) {
  const owner = conversationAttempt(cleanupAccountId); if (!owner) throw Error("Invalid cleanup account.");
  await serial(storage, owner, async () => {
    const prefix = `${CONVERSATION_JOURNAL_ROOT}${owner}/`;
    for (const key of keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key);
  });
}
