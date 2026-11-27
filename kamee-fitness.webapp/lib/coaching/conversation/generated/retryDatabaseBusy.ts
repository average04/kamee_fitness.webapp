// Generated from src/lib/retryDatabaseBusy.ts; run the app sync-coaching-conversation-client script. Do not edit.
const DELAYS = [100, 300] as const;

/** Retry only errors proving that the database rolled the write back. */
export async function withDatabaseBusyRetry<T>(
  operation: () => Promise<T>,
  assertActor: () => Promise<void>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    await assertActor();
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if ((code !== '55P03' && code !== 'PT503') || attempt >= DELAYS.length) throw error;
      await assertActor();
      await new Promise<void>(resolve => setTimeout(resolve, DELAYS[attempt]));
      continue;
    }
    // A stale result must not reach the new account. This check is outside the
    // retry catch: the successful operation may already have committed.
    await assertActor();
    return result;
  }
}
