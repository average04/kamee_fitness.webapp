import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { coachListingId, coachPricingFixture, publishedCoachTerms } from "./coach-pricing-fixtures";
const m = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), db: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coaching/auth", () => ({ getCoachSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: m.db }));
import { acceptCoachSellerTerms, refreshCoachPricing, saveCoachPrice } from "@/app/coaching/(hub)/plans/pricing-actions";

let workspace = coachPricingFixture(true);
let terms = publishedCoachTerms;
let mutationError: {message:string;code?:string} | null = null;
beforeEach(() => {
  vi.clearAllMocks(); workspace = coachPricingFixture(true); terms = publishedCoachTerms; mutationError = null;
  m.session.mockResolvedValue({user: {id:"session-coach"}, role:"coach", status:"approved"}); m.db.mockResolvedValue({rpc:m.rpc});
  m.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
    if (name === "get_coaching_pricing_workspace") return {data:workspace,error:null};
    if (name === "get_coaching_seller_terms") return {data:{terms},error:null};
    if (mutationError) return {data:null,error:mutationError};
    if (name === "accept_coaching_seller_terms") {
      workspace = {...workspace,canRequestPrice:workspace.options.some(option=>option.enabled),acceptance:{version:terms.version,contentHash:terms.contentHash,acceptedAt:"2026-10-27T01:00:00Z"}};
      return {data:{...workspace.acceptance,sellerId:coachListingId,acceptanceId:coachListingId},error:null};
    }
    if (name === "set_coaching_listing_price") {
      workspace = {...workspace,requestedOptionCurrent:true,pricing:{...workspace.pricing, revision:"9007199254740994",requested:{id:coachListingId,optionId:args.p_option_id,referenceMoney:workspace.options[0].referenceMoney,acceptedTermsVersion:terms.version,requestedAt:"2026-10-27T01:00:00Z"}}};
      return {data:workspace.pricing,error:null};
    }
    throw new Error(name);
  });
});
const input = () => ({ listingId:coachListingId, optionId:workspace.options[0].id, expectedRevision:workspace.pricing.revision });
const accepted = () => { workspace.acceptance = {version:terms.version,contentHash:terms.contentHash,acceptedAt:"2026-10-27T01:00:00Z"}; workspace.canRequestPrice = workspace.options.some(option=>option.enabled); };
describe("coach pricing actions", () => {
  it.each([null, {id:"expired"}])("requires authenticated approved coach context before reading or mutating", async user => {
    m.session.mockResolvedValue({user,role:"user",status:"approved"});
    expect((await saveCoachPrice(input())).error?.code).toBe("unauthorized");
    expect((await acceptCoachSellerTerms(coachListingId, terms, true)).error?.code).toBe("unauthorized");
    expect((await refreshCoachPricing(coachListingId)).error?.code).toBe("unauthorized");
    expect(m.db).not.toHaveBeenCalled();
  });
  it("requires current commercial consent before any price write", async () => {
    expect((await saveCoachPrice(input())).error?.code).toBe("terms_outdated");
    expect(m.rpc.mock.calls.some(([name])=>name === "set_coaching_listing_price")).toBe(false);
  });
  it("uses cookie-bound identity, strict input and exact string CAS; returns refreshed pricing", async () => {
    accepted();
    expect((await saveCoachPrice({...input(),actorId:"forged"})).error?.code).toBe("invalid_input");
    const result = await saveCoachPrice(input());
    expect(m.rpc).toHaveBeenCalledWith("set_coaching_listing_price",{p_listing_id:coachListingId,p_option_id:workspace.options[0].id,p_expected_revision:"9007199254740993"});
    expect(result.data?.workspace?.pricing.revision).toBe("9007199254740994");
    expect(result.mutationApplied).toBe(true);
    expect(m.rpc.mock.calls.every(([,args]) => !args || !("p_actor_id" in args))).toBe(true);
    const source = readFileSync(new URL("../../app/coaching/(hub)/plans/pricing-actions.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/service|revalidatePath|redirect|router\.refresh/);
  });
  it("keeps all-disabled options read-only", async () => {
    accepted(); workspace.options.forEach(o => o.enabled = false); workspace.canRequestPrice = false;
    expect((await saveCoachPrice(input())).error?.code).toBe("option_disabled");
    expect(m.rpc.mock.calls.some(([name])=>name === "set_coaching_listing_price")).toBe(false);
  });
  it("does not silently overwrite stale state and refetches backend conflicts", async () => {
    accepted();
    expect((await saveCoachPrice({...input(),expectedRevision:"1"})).error?.code).toBe("conflict");
    mutationError = {message:"revision_conflict"};
    const result = await saveCoachPrice(input());
    expect(result.error?.code).toBe("conflict"); expect(result.data?.workspace?.pricing.revision).toBe("9007199254740993");
  });
  it("requires an explicit checkbox and exact currently published body identity", async () => {
    const consent = {version:terms.version,contentHash:terms.contentHash};
    expect((await acceptCoachSellerTerms(coachListingId,consent,false)).error?.code).toBe("invalid_input");
    expect((await acceptCoachSellerTerms(coachListingId,{...consent,version:"stale"},true)).error?.code).toBe("terms_outdated");
    expect(m.rpc.mock.calls.some(([name])=>name === "accept_coaching_seller_terms")).toBe(false);
    const result = await acceptCoachSellerTerms(coachListingId,consent,true);
    expect(m.rpc).toHaveBeenCalledWith("accept_coaching_seller_terms",{p_version:terms.version,p_content_hash:terms.contentHash});
    expect(result.data?.workspace?.acceptance?.contentHash).toBe(terms.contentHash);
  });
  it("invalidates consent if publication changes during acceptance", async () => {
    m.rpc.mockImplementation(async (name:string) => name === "get_coaching_pricing_workspace" ? {data:workspace,error:null} : name === "get_coaching_seller_terms" ? {data:{terms},error:null} : {data:null,error:{message:"terms_outdated"}});
    expect((await acceptCoachSellerTerms(coachListingId,{version:terms.version,contentHash:terms.contentHash},true)).error?.code).toBe("terms_outdated");
  });
  it("reports unavailable RPCs and malformed response without leaking provider errors", async () => {
    m.rpc.mockResolvedValue({data:null,error:{message:"Could not find function secret endpoint",code:"PGRST202"}});
    const result = await refreshCoachPricing(coachListingId);
    expect(result.error?.code).toBe("unavailable"); expect(result.error?.message).not.toContain("secret");
    m.rpc.mockResolvedValue({data:{},error:null});
    expect((await refreshCoachPricing(coachListingId)).error?.code).toBe("unavailable");
  });
  it("maps the existing SQL option race error to an actionable disabled-option response", async () => {
    accepted(); mutationError = {message:"Unsupported price option",code:"22023"};
    expect((await saveCoachPrice(input())).error?.code).toBe("option_disabled");
  });
});
