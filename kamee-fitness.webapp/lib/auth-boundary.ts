/** No account content is carried across tabs. Sign-out hides, but does not erase recovery. */
const CHANNEL = "kamee-auth-boundary-v1";
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let listening = false;
function receive() { for (const listener of [...listeners]) listener(); }
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL); channel.onmessage = receive;
  }
  window.addEventListener("storage", event => { if (event.key === CHANNEL) receive(); });
}
export function subscribeAuthBoundary(listener: () => void) {
  listen(); listeners.add(listener); return () => { listeners.delete(listener); };
}
/** Call synchronously before a server sign-out form is submitted. */
export function broadcastAuthBoundary() {
  receive(); listen(); channel?.postMessage("retire");
  try { window.localStorage.setItem(CHANNEL, `${Date.now()}:${Math.random()}`); } catch { /* BroadcastChannel still covers supported browsers. */ }
}
