export type ConversationSignals = { focused: boolean; visible: boolean; online: boolean };
/** Pure signals adapter; actual browser focus/visibility are wired by the surface. */
export function createConversationLifecycle(ports: {
  verify(): Promise<unknown>; refresh(): Promise<unknown>; setActive(active: boolean): void;
  setAvailable?(available: boolean): void;
  schedule(tick: () => void, milliseconds: number): () => void;
}) {
  let disposed = false; let revision = 0; let stop: (() => void) | undefined;
  let refreshing: Promise<unknown> | null = null;
  return {
    async update(signals: ConversationSignals) {
      if (disposed) return;
      const captured = ++revision; stop?.(); stop = undefined;
      const active = signals.focused && signals.visible && signals.online;
      // Verification precedes exposing authority or resuming a polling interval.
      ports.setActive(false);
      ports.setAvailable?.(active);
      if (!active) return;
      try { await ports.verify(); } catch { return; }
      if (disposed || captured !== revision) return;
      ports.setActive(active);
      if (!active) return;
      const refresh = () => {
        if (disposed || captured !== revision) return Promise.resolve();
        if (refreshing) return refreshing;
        refreshing = ports.refresh().catch(() => {}).finally(() => { refreshing = null; });
        return refreshing;
      };
      stop = ports.schedule(() => { void refresh(); }, 15_000);
      await refresh();
    },
    dispose() { disposed = true; revision++; stop?.(); ports.setActive(false); ports.setAvailable?.(false); },
  };
}
