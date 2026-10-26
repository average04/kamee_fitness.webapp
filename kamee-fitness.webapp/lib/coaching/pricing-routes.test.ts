import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { coachListingId } from "./coach-pricing-fixtures";
const m=vi.hoisted(()=>({read:vi.fn(),list:vi.fn(),rpc:vi.fn(),editor:vi.fn(),panel:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/coaching/auth",()=>({requireCoach:async()=>({user:{id:"owner"}})}));
vi.mock("@/lib/coaching/pricing-query",()=>({readCoachPricing:m.read,loadCoachPlanList:m.list}));
vi.mock("@/lib/coaching/catalog",()=>({loadCoachingCatalog:async()=>[]}));
vi.mock("@/app/coaching/(hub)/plans/pricing-actions",()=>({saveCoachPrice:vi.fn(),acceptCoachSellerTerms:vi.fn(),refreshCoachPricing:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createServerSupabase:async()=>({rpc:m.rpc,from:()=>({select:()=>({in:()=>({order:async()=>({data:[],error:null})})})})})}));
vi.mock("@/components/coaching/plans/PlanEditor",()=>({PlanEditor:(props:unknown)=>{m.editor(props);return createElement("div",null,"approved content editor");}}));
vi.mock("@/components/coaching/plans/PlanPricingPanel",()=>({PlanPricingPanel:(props:unknown)=>{m.panel(props);return createElement("section",null,"separate pricing");}}));
vi.mock("@/components/coaching/CoachLink",()=>({CoachLink:({children,...props}:Record<string,unknown>)=>createElement("a",props,children as string)}));
import PlanPage from "@/app/coaching/(hub)/plans/[id]/page";
import PlansPage from "@/app/coaching/(hub)/plans/page";
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:{id:"version",listing_id:coachListingId,version_state:"approved"},error:null});m.read.mockResolvedValue({error:{code:"unavailable",message:"Retry pricing"}});});
describe("pricing route composition",()=>{
  it("keeps approved content available beside an independent panel when pricing is unavailable",async()=>{
    const output=renderToStaticMarkup(await PlanPage({params:Promise.resolve({id:"version"})}));
    expect(output).toContain("approved content editor");expect(output).toContain("separate pricing");
    expect(m.editor.mock.calls[0][0].initial).toEqual({id:"version",listing_id:coachListingId,version_state:"approved"});
    expect(m.panel.mock.calls[0][0].listingId).toBe(coachListingId);
    expect(m.panel.mock.calls[0][0].actions).toMatchObject({save:expect.any(Function),accept:expect.any(Function),refresh:expect.any(Function)});
  });
  it("shows an honest unavailable badge without hiding grouped plan cards",async()=>{
    m.list.mockResolvedValue({canManagePlans:true,plans:[{id:"version",listingId:coachListingId,title:"My plan",versionNo:2,state:"approved",weeksCount:4,discipline:"strength"}],requests:[],summaries:[],pricingError:true});
    const output=renderToStaticMarkup(await PlansPage());
    expect(output).toContain("My plan");expect(output).toContain("Pricing unavailable");expect(output).not.toMatch(/>Free</);
  });
});
