import type { createBrowserConversationRuntime } from "../conversation/runtime";
import { utf8ByteLength } from "../conversation/generated/utf8ByteLength";
import { CoachingProposalError, createCoachingProposalsApi } from "./api";
const coachRpcs = new Set(["get_coaching_proposal_consent", "set_coaching_proposal_consent", "get_coaching_proposal_edit_targets", "preview_coaching_proposal",
  "get_coaching_proposal_preview", "send_coaching_proposal", "withdraw_coaching_proposal", "get_coaching_proposal", "list_coaching_proposals"]);
const serverCodes = new Set(["PT400", "PT401", "PT403", "PT404", "PT409", "PT503"]);
export async function captureBrowserProposalsApi(runtime: ReturnType<typeof createBrowserConversationRuntime>) {
  const captured = await runtime.capture(), port = captured.participant;
  port.assertCurrent();
  const root = new URL(port.baseUrl), loopback = ["localhost", "127.0.0.1", "[::1]"].includes(root.hostname);
  if ((root.protocol !== "https:" && !(root.protocol === "http:" && loopback)) || root.pathname !== "/" || root.search || root.hash || root.username || root.password || !port.anonKey) throw new CoachingProposalError("transport_unavailable");
  return createCoachingProposalsApi({ actor: { userId: captured.actor.accountId }, assertCurrent: port.assertCurrent,
    request: async (name, args, outer) => {
      port.assertCurrent(); if (!coachRpcs.has(name)) throw new CoachingProposalError("unsupported_coach_action");
      const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
      const abort = () => controller.abort(); outer?.addEventListener("abort", abort, { once: true });
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new CoachingProposalError("transport_unavailable")); }, 15000); });
      const work = (async () => {
        const response = await port.fetch(root.origin + "/rest/v1/rpc/" + name, { method: "POST", redirect: "error", signal: controller.signal,
          headers: { Authorization: `Bearer ${captured.token}`, apikey: port.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(args) });
        port.assertCurrent();
        const text = await response.text(); port.assertCurrent();
        if (utf8ByteLength(text) > 1048576) throw new CoachingProposalError("invalid_response");
        let wire: unknown;
        try { wire = JSON.parse(text); } catch { throw new CoachingProposalError("invalid_response", response.status); }
        if (!response.ok) {
          const code = wire && typeof wire === "object" && "code" in wire && typeof wire.code === "string" && serverCodes.has(wire.code) ? wire.code : "transport_unavailable";
          throw new CoachingProposalError(code, response.status);
        }
        return wire;
      })();
      try { const result = await Promise.race([work, deadline]); port.assertCurrent(); return result; }
      finally { clearTimeout(timer); outer?.removeEventListener("abort", abort); }
    } });
}
