import { beforeEach, describe, expect, it, vi } from "vitest";
import { coachListingId, coachPricingFixture, publishedCoachTerms } from "./coach-pricing-fixtures";
const m = vi.hoisted(()=>({auth:vi.fn(),db:vi.fn(),from:vi.fn(),rpc:vi.fn(),planEq:vi.fn(),requestEq:vi.fn(),planOrder:vi.fn(),requestOrder:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/coaching/auth",()=>({requireCoach:m.auth,getCoachSession:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createServerSupabase:m.db}));
import { loadCoachPlanList, readCoachPricing } from "./pricing-query";
const row = (id:string,listing_id:string,version_no:number) => ({id,listing_id,version_no,title:"Coach plan",version_state:"approved",discipline:"strength",weeks_count:4});
beforeEach(()=>{
  vi.clearAllMocks(); m.auth.mockResolvedValue({user:{id:"owner"},status:"approved"});
  m.planEq.mockReturnThis();m.requestEq.mockReturnThis();
  m.from.mockImplementation((table:string)=>({select:()=>table==="plans"?{eq:m.planEq,order:m.planOrder}:{eq:m.requestEq,order:m.requestOrder}}));
  const planQuery = {eq:m.planEq,order:m.planOrder}; m.planEq.mockReturnValue(planQuery);
  const requestQuery = {eq:m.requestEq,order:m.requestOrder};m.requestEq.mockReturnValue(requestQuery);
  m.planOrder.mockResolvedValue({data:[row("old",coachListingId,1),row("latest",coachListingId,3)],error:null});
  m.requestOrder.mockResolvedValue({data:[],error:null});
  m.rpc.mockImplementation(async (_name:string,args:{p_listing_ids:string[]})=>({data:{items:args.p_listing_ids.map(listingId=>({listingId,revision:"0",requested:null,platforms:coachPricingFixture().platforms}))},error:null}));
  m.db.mockResolvedValue({from:m.from,rpc:m.rpc});
});
describe("coach plan pricing reads",()=>{
  it("scopes plans to the session author, groups versions by listing and batches listing IDs",async()=>{
    const result=await loadCoachPlanList();
    expect(m.planEq).toHaveBeenCalledWith("author_id","owner");expect(m.planEq).toHaveBeenCalledWith("kind","coach");
    expect(m.requestEq).toHaveBeenCalledWith("coach_id","owner");
    expect(result.plans.map(p=>p.id)).toEqual(["latest"]);
    expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.rpc).toHaveBeenCalledWith("get_my_coaching_pricing_summaries",{p_listing_ids:[coachListingId]});
  });
  it("caps each owner summary batch at 100, without a workspace RPC per card",async()=>{
    m.planOrder.mockResolvedValue({data:Array.from({length:101},(_,i)=>row(`v${i}`,`10000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`,1)),error:null});
    const result = await loadCoachPlanList();
    expect(result.summaries).toHaveLength(101);expect(m.rpc.mock.calls.map(([,args])=>args.p_listing_ids.length)).toEqual([100,1]);
  });
  it("does not query authoring or pricing data for an unapproved coach",async()=>{
    m.auth.mockResolvedValue({user:{id:"owner"},status:"in_review"});expect((await loadCoachPlanList()).canManagePlans).toBe(false);expect(m.db).not.toHaveBeenCalled();
  });
  it("preserves plan cards when commerce is undeployed, and rejects unrelated summary identities",async()=>{
    m.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
    expect(await loadCoachPlanList()).toMatchObject({pricingError:true,plans:[{id:"latest"}],summaries:[]});
    m.rpc.mockResolvedValue({data:{items:[{listingId:"30000000-0000-0000-0000-000000000001",revision:"0",requested:null,platforms:coachPricingFixture().platforms}]},error:null});
    expect((await loadCoachPlanList()).summaries).toEqual([]);
  });
  it("rejects a workspace for another listing and mismatched published terms without inventing a body",async()=>{
    const db=await m.db();
    m.rpc.mockImplementation(async(name:string)=>({data:name==="get_coaching_seller_terms"?{terms:publishedCoachTerms}:coachPricingFixture(),error:null}));
    expect((await readCoachPricing(db,"30000000-0000-0000-0000-000000000001")).error?.code).toBe("unavailable");
    m.rpc.mockImplementation(async(name:string)=>({data:name==="get_coaching_seller_terms"?{terms:{...publishedCoachTerms,contentHash:"b".repeat(64)}}:coachPricingFixture(),error:null}));
    expect((await readCoachPricing(db,coachListingId)).data).toMatchObject({terms:null,termsError:true});
  });
});
