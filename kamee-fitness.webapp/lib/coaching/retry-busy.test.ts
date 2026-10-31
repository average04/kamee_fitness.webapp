import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDatabaseBusyRetry } from "./retry-busy";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("definitive database busy rollback retries", () => {
  it("checks the actor before the first attempt and returns the original result", async () => {
    const order: string[] = [];
    const result = { revision: "9007199254740993" };
    const value = await withDatabaseBusyRetry(
      async () => {
        order.push("write");
        return result;
      },
      async () => {
        order.push("actor");
      },
    );
    expect(value).toBe(result);
    expect(order).toEqual(["actor", "write"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["55P03", "PT503"])(
    "retries %s exactly after 100ms and 300ms with a fresh actor assertion",
    async (code) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code })
        .mockRejectedValueOnce({ code })
        .mockResolvedValue("done");
      const assertActor = vi.fn().mockResolvedValue(undefined);
      const result = withDatabaseBusyRetry(operation, assertActor);
      void result.catch(() => undefined); // Keep an unexpected rejection observed during timer assertions.
      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(99);
      expect(operation).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(299);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toBe("done");
      expect(operation).toHaveBeenCalledTimes(3);
      expect(assertActor).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("returns the final busy failure after two retries without leaving a timer", async () => {
    const failure = { code: "55P03", message: "busy" };
    const operation = vi.fn().mockRejectedValue(failure);
    const assertActor = vi.fn().mockResolvedValue(undefined);
    const result = withDatabaseBusyRetry(operation, assertActor).catch(
      (error) => error,
    );
    await vi.runAllTimersAsync();
    expect(await result).toBe(failure);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(assertActor).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { code: "PT403" },
    { code: "PT409" },
    { code: "57014" },
    { code: "40001" },
    { status: 503 },
    { message: "55P03" },
    { cause: { code: "55P03" } },
    { code: "ETIMEDOUT" },
    new TypeError("Failed to fetch"),
    new Error("unknown commit"),
    null,
  ])(
    "never retries permission, conflict, timeout or ambiguous transport failure %j",
    async (failure) => {
      const operation = vi.fn().mockRejectedValue(failure);
      const assertActor = vi.fn().mockResolvedValue(undefined);
      await expect(withDatabaseBusyRetry(operation, assertActor)).rejects.toBe(
        failure,
      );
      expect(operation).toHaveBeenCalledTimes(1);
      expect(assertActor).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("stops before a retry when the actor changes and does not retry actor-check errors", async () => {
    const failure = { code: "PT503", message: "actor changed" };
    const operation = vi.fn().mockRejectedValue({ code: "55P03" });
    const assertActor = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(failure);
    const result = withDatabaseBusyRetry(operation, assertActor).catch(
      (error) => error,
    );
    await vi.runAllTimersAsync();
    expect(await result).toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(assertActor).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not call the operation or retry when the initial actor assertion fails", async () => {
    const failure = { code: "55P03", message: "identity check failed" };
    const operation = vi.fn();
    const assertActor = vi.fn().mockRejectedValue(failure);
    await expect(withDatabaseBusyRetry(operation, assertActor)).rejects.toBe(
      failure,
    );
    expect(operation).not.toHaveBeenCalled();
    expect(assertActor).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
