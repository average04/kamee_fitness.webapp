import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanPricingPanel } from "@/components/coaching/plans/PlanPricingPanel";
import { SellerTermsAcceptance } from "@/components/coaching/plans/SellerTermsAcceptance";
import { coachListingId, coachPricingFixture, publishedCoachTerms } from "./coach-pricing-fixtures";
import { coachPricingBadge, coachPricingError, formatReferenceMoney, parsePublishedSellerTerms, type CoachPricingActions } from "./coach-pricing";
const actions:CoachPricingActions = {save:async()=>({}),accept:async()=>({}),refresh:async()=>({})};
const html = (workspace=coachPricingFixture(),terms:typeof publishedCoachTerms|null=publishedCoachTerms) => renderToStaticMarkup(createElement(PlanPricingPanel,{listingId:coachListingId,initial:{data:{workspace,terms,termsError:false}},actions}));
describe("coach pricing rendering",()=>{
  it("keeps all 45 supported options visible and disabled while pricing is prepared",()=>{
    const output=html(); expect((output.match(/<option /g)||[]).length).toBe(46);
    expect(output).toContain("Pricing is being prepared");expect(output).toMatch(/<button[^>]*disabled=""[^>]*>Save price<\/button>/);
    expect(output).toContain("PHP 20,000");expect(output).toContain("Reference price (PHP)");expect(output).not.toMatch(/>Free</);
  });
  it("enables the independent save path for a local enabled and accepted fixture",()=>{
    const workspace=coachPricingFixture(true); workspace.acceptance={version:publishedCoachTerms.version,contentHash:publishedCoachTerms.contentHash,acceptedAt:"2026-10-27T00:00:00Z"}; workspace.canRequestPrice=true;
    workspace.pricing.requested={id:coachListingId,optionId:workspace.options[0].id,referenceMoney:workspace.options[0].referenceMoney,acceptedTermsVersion:publishedCoachTerms.version,requestedAt:"2026-10-27T00:00:00Z"};
    const output=html(workspace);expect(output).toMatch(/<button[^>]*type="submit"[^>]*>Save price<\/button>/);
    expect(output).not.toMatch(/<button[^>]*disabled=""[^>]*>Save price<\/button>/);
    expect(output).toContain("Commercial terms accepted");
  });
  it("shows a retained disabled option while keeping Save unavailable",()=>{
    const workspace=coachPricingFixture(true);
    workspace.acceptance={version:publishedCoachTerms.version,contentHash:publishedCoachTerms.contentHash,acceptedAt:"2026-10-27T00:00:00Z"};workspace.canRequestPrice=true;
    workspace.options[4].enabled=false;
    workspace.pricing.requested={id:coachListingId,optionId:workspace.options[4].id,referenceMoney:workspace.options[4].referenceMoney,acceptedTermsVersion:publishedCoachTerms.version,requestedAt:"2026-10-27T00:00:00Z"};
    const output=html(workspace);
    expect(output).toMatch(/<option[^>]*disabled=""[^>]*selected=""[^>]*>PHP 600 · Unavailable<\/option>/);
    expect(output).toMatch(/<button[^>]*disabled=""[^>]*>Save price<\/button>/);
  });
  it("shows current effective price/version beside a different requested price and setup failure",()=>{
    const workspace=coachPricingFixture();
    const request={id:coachListingId,optionId:workspace.options[0].id,referenceMoney:workspace.options[0].referenceMoney,acceptedTermsVersion:publishedCoachTerms.version,requestedAt:"2026-10-27T00:00:00Z"};
    workspace.pricing.requested={...request,id:workspace.options[2].id,referenceMoney:workspace.options[2].referenceMoney};
    workspace.requestedOptionCurrent=true;
    workspace.platforms[0]={...workspace.platforms[0],state:"active",effective:request,effectiveVersionId:coachListingId,effectiveVersionNo:1,setupOutcome:"failed",matchesCurrentVersion:false};
    const output=html(workspace);expect(output).toContain("Requested reference price");expect(output).toContain("PHP 400");expect(output).toContain("PHP 200");
    expect(output).toContain("Content version 1");expect(output).toContain("New-price setup failed");expect(output).toContain("matching verified offer");
    expect(output).toContain("Apple · Production");expect(output).toContain("Google · Production");expect(output).toContain("Sandbox test details");expect(output).toContain("Purchases are currently off");
  });
  it("keeps missing terms distinct from unavailable pricing and provides a pricing-only retry",()=>{
    const output=html(coachPricingFixture(),null);expect(output).toContain("Commercial terms are not available yet");
    const unavailable=renderToStaticMarkup(createElement(PlanPricingPanel,{listingId:coachListingId,initial:{error:coachPricingError("unavailable")},actions}));
    expect(unavailable).toContain("Retry pricing");expect(unavailable).toContain("role=\"alert\"");
  });
  it("renders the exact RPC body as escaped text with an unchecked explicit checkbox",()=>{
    const output=renderToStaticMarkup(createElement(SellerTermsAcceptance,{terms:publishedCoachTerms,accepted:false,pending:false,onAccept:async()=>{}}));
    expect(output).toContain("Exact published terms.\n&lt;script&gt;Not HTML&lt;/script&gt;");expect(output).not.toContain("<script>");
    expect(output).toContain('type="checkbox"');expect(output).not.toContain('checked=""');expect(output).toContain("I accept these commercial terms");
    expect(parsePublishedSellerTerms({terms:publishedCoachTerms})?.body).toBe(publishedCoachTerms.body);
    expect(()=>parsePublishedSellerTerms({terms:{...publishedCoachTerms,body:null}})).toThrow();
  });
  it("keeps monetary formatting exact and never labels absent pricing Free",()=>{
    expect(formatReferenceMoney({currency:"PHP",exponent:2,minor:"9223372036854775807"})).toBe("PHP 92,233,720,368,547,758.07");
    const workspace=coachPricingFixture();expect(coachPricingBadge({listingId:coachListingId,revision:"0",requested:null,platforms:workspace.platforms})).toBe("Price not set");
    expect(coachPricingBadge(undefined)).toBe("Pricing unavailable");
  });
});
