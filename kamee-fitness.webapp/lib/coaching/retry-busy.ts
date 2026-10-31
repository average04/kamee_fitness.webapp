export async function withDatabaseBusyRetry<T>(
  operation: () => Promise<T>,
  assertActor: () => Promise<void>,
): Promise<T> {
  const delays = [100, 300];
  for (let attempt = 0; ; attempt++) {
    // Identity failures are never retried, even if they happen to carry a busy code.
    await assertActor();
    try {
      return await operation();
    } catch (error) {
      const code =
        error !== null && typeof error === "object" && "code" in error
          ? error.code
          : null;
      if ((code !== "55P03" && code !== "PT503") || attempt >= delays.length)
        throw error;
      // These two codes confirm transaction rollback. A timeout or bare HTTP503 does not.
      await new Promise<void>((resolve) =>
        setTimeout(resolve, delays[attempt]),
      );
    }
  }
}
