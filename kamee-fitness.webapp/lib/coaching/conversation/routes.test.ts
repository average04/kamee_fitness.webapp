import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ enabled: false, allowed: true, authCalls: 0 }));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach: async () => { f.authCalls++; if (!f.allowed) throw Error("denied"); return { user: { id: "00000000-0000-4000-8000-000000000001" }, status: "onboarding" }; } }));
vi.mock("@/lib/coaching/conversation/flags", async importOriginal => ({ ...await importOriginal<typeof import("./flags")>(), get COACHING_CONVERSATIONS_ENABLED() { return f.enabled; } }));
vi.mock("@/lib/coaching/dashboard-query", () => ({ loadCoachDashboard: async () => ({ displayName: null, plans: [], plansError: false, canManagePlans: false }) }));
vi.mock("@/components/coaching/conversation/CoachClients", () => ({ CoachClients: () => null }));
vi.mock("@/components/coaching/conversation/CoachConversation", () => ({ CoachConversation: () => null }));
vi.mock("@/components/coaching/dashboard/CoachBusinessDashboard", () => ({ CoachBusinessDashboard: () => null }));
vi.mock("next/navigation", () => ({ notFound() { throw Error("not found"); } }));
import ClientsPage from "@/app/coaching/(hub)/clients/page";
import ConversationPage from "@/app/coaching/(hub)/clients/[attemptId]/page";
import { CoachClients } from "@/components/coaching/conversation/CoachClients";
import { CoachConversation } from "@/components/coaching/conversation/CoachConversation";
import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
const id = "00000000-0000-4000-8000-000000000002";
beforeEach(() => { f.enabled = false; f.allowed = true; f.authCalls = 0; });
describe("coach conversation entry boundary", () => {
  it("keeps the labelled sample Clients surface and rejects detail routes by default", async () => {
    const page = await ClientsPage(); expect(page.type).toBe(CoachBusinessDashboard); expect(page.props.view).toBe("clients");
    await expect(ConversationPage({ params: Promise.resolve({ attemptId: id }) })).rejects.toThrow("not found");
    expect(f.authCalls).toBe(2);
  });
  it("passes only verified serializable identity and exact validated attempt when locally enabled", async () => {
    f.enabled = true;
    const list = await ClientsPage(); expect(list.type).toBe(CoachClients); expect(list.props).toEqual({ accountId: "00000000-0000-4000-8000-000000000001" });
    const page = await ConversationPage({ params: Promise.resolve({ attemptId: id }) });
    expect(page.type).toBe(CoachConversation); expect(page.props).toEqual({ accountId: "00000000-0000-4000-8000-000000000001", attemptId: id });
    await expect(ConversationPage({ params: Promise.resolve({ attemptId: "../other" }) })).rejects.toThrow("not found");
  });
  it("repeats server authorization even when a shell might already exist", async () => {
    f.enabled = true; f.allowed = false;
    await expect(ClientsPage()).rejects.toThrow("denied");
    await expect(ConversationPage({ params: Promise.resolve({ attemptId: id }) })).rejects.toThrow("denied");
  });
});
