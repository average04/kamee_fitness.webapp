import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixtureIds as ids, makeAdminCommerceFixture } from "./commerce-admin-fixtures";
const mocks = vi.hoisted(()=>({auth:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/admin/auth",()=>({requireAdmin:mocks.auth}));
vi.mock("@/lib/supabase/admin",()=>({createAdminSupabase:mocks.client}));
import { listAdminPricing, refreshAdminProductWorkspace, registerAdminStoreProduct, setAdminProductReadiness, setAdminPriceOption, prepareAdminSellerTerms, publishAdminSellerTerms } from "@/app/admin/(panel)/coaching-commerce/actions";

const register = () => ({listingId:ids.listing,platform:"android",expectedListingRevision:"4",storeAppId:"synthetic.app",storeProductId:"new.product",projectKey:"synthetic-project",providerAppId:"synthetic-app",providerProductId:"new-provider-product",expectedRegistryRevision:"7",evidenceRef:"Operator reviewed immutable identity"});
const readiness = () => ({productId:ids.product,environment:"SANDBOX",expectedListingRevision:"4",expectedReadinessRevision:"2",expectedSetupRevision:"9",priceRevisionId:ids.request,evidenceRef:"New-price setup failed; previous offer preserved",action:"record_setup",outcome:"failed"});
beforeEach(()=>{
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({id:ids.actor});
  mocks.client.mockImplementation(()=>({rpc:mocks.rpc}));
  mocks.rpc.mockResolvedValue({data:makeAdminCommerceFixture(true),error:null});
});
describe("admin action security boundaries",()=>{
  const calls = [
    ()=>listAdminPricing(), ()=>refreshAdminProductWorkspace(ids.listing),
    ()=>registerAdminStoreProduct(register()), ()=>setAdminProductReadiness(ids.listing,readiness()),
    ()=>setAdminPriceOption(ids.listing,{}), ()=>prepareAdminSellerTerms({}),
    ()=>publishAdminSellerTerms(ids.listing,{}),
  ];
  it.each(calls.map((call,i)=>[i,call] as const))("action %s denies unauthenticated, coach and member direct calls before service access",async (_i,call)=>{
    for(const role of ["unauthenticated","coach","member"]) {
      mocks.auth.mockRejectedValueOnce(new Error(`Denied ${role}`));
      await expect(call()).rejects.toThrow("Denied");
      expect(mocks.client).not.toHaveBeenCalled();
    }
  });
  it("reads with the authenticated actor after the admin gate",async()=>{
    await refreshAdminProductWorkspace(ids.listing);
    expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.client.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_get_coaching_product_workspace",{p_actor_id:ids.actor,p_listing_id:ids.listing});
  });
  it("rejects an injected actor instead of forwarding it",async()=>{
    const result = await registerAdminStoreProduct({...register(),actorId:ids.version});
    expect(result.error?.code).toBe("invalid_input");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps setup read-only without the stronger database capability",async()=>{
    mocks.rpc.mockResolvedValue({data:makeAdminCommerceFixture(false),error:null});
    const result = await setAdminProductReadiness(ids.listing,readiness());
    expect(result.error?.code).toBe("operator_permission_required");
    expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["admin_get_coaching_product_workspace"]);
    expect(result.data?.canManageProducts).toBe(false);
  });
  it("stops stale setup CAS before writing",async()=>{
    const result = await setAdminProductReadiness(ids.listing,{...readiness(),expectedSetupRevision:"8"});
    expect(result.error?.code).toBe("conflict");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("uses the session actor and frozen input on the mutation",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(true),error:null})
      .mockResolvedValueOnce({data:{productId:ids.product,environment:"SANDBOX",revision:"2",setupRevision:"10",state:"unconfigured",offerRevision:null,setupOutcome:"failed"},error:null});
    const result = await setAdminProductReadiness(ids.listing,readiness());
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"admin_set_coaching_product_readiness",{p_actor_id:ids.actor,p_input:readiness()});
    expect(result.mutationApplied).toBe(true);
  });
  it("refreshes after database conflict and allows an explicitly reviewed retry",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(true),error:null})
      .mockResolvedValueOnce({data:null,error:{message:"revision_conflict"}});
    expect((await setAdminProductReadiness(ids.listing,readiness())).error?.code).toBe("conflict");
    expect(mocks.rpc.mock.calls.at(-1)?.[0]).toBe("admin_get_coaching_product_workspace");
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(true),error:null})
      .mockResolvedValueOnce({data:{productId:ids.product,environment:"SANDBOX",revision:"2",setupRevision:"10",state:"unconfigured",offerRevision:null,setupOutcome:"failed"},error:null});
    expect((await setAdminProductReadiness(ids.listing,readiness())).mutationApplied).toBe(true);
  });
  it("reports absent hosted RPCs without fabricated data or success",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202",message:"function not found"}});
    const result = await refreshAdminProductWorkspace(ids.listing);
    expect(result.error?.code).toBe("unavailable");
    expect(result.data).toBeUndefined();
    expect(result.mutationApplied).toBeUndefined();
  });
  it("records immutable registration with the session actor and matching registry CAS",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(true),error:null})
      .mockResolvedValueOnce({data:{productId:ids.product,created:true,readinessRevisions:{SANDBOX:"0",PRODUCTION:"0"}},error:null});
    expect((await registerAdminStoreProduct(register())).mutationApplied).toBe(true);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"admin_register_coaching_store_product",{p_actor_id:ids.actor,p_input:register()});
  });
  it("rejects a stale provider registry without attempting registration",async()=>{
    expect((await registerAdminStoreProduct({...register(),expectedRegistryRevision:"6"})).error?.code).toBe("conflict");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("blocks a guessed PHP mapping before effective-offer verification",async()=>{
    const confirm={productId:ids.product,environment:"SANDBOX",expectedListingRevision:"4",expectedReadinessRevision:"2",expectedSetupRevision:"9",priceRevisionId:ids.request,evidenceRef:"Synthetic verification evidence",action:"confirm_effective_offer",expectedVersionId:ids.version,verifiedPhpMoney:{currency:"PHP",exponent:2,minor:"30000"},storePricePointRef:"synthetic-point",storeReviewStatus:"approved"};
    expect((await setAdminProductReadiness(ids.listing,confirm)).error?.code).toBe("conflict");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("keeps option changes separate, actor-derived and CAS-protected while preserving nullable legacy tier",async()=>{
    const option=makeAdminCommerceFixture().workspace.options[0];
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(),error:null})
      .mockResolvedValueOnce({data:{optionId:option.id,enabled:true,legacyTier:null,revision:"1"},error:null});
    const result=await setAdminPriceOption(ids.listing,{optionId:option.id,enabled:true,legacyTier:null,expectedRevision:"0",reason:"Synthetic explicit release review"});
    expect(result.mutationApplied).toBe(true);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"admin_set_coaching_price_option",{p_actor_id:ids.actor,p_option_id:option.id,p_enabled:true,p_legacy_tier:null,p_expected_revision:"0"});
    expect(mocks.rpc.mock.calls.every(c=>!String(c[0]).includes("flag"))).toBe(true);
  });
  it("rejects stale option revision without a write",async()=>{
    const option=makeAdminCommerceFixture().workspace.options[0];
    expect((await setAdminPriceOption(ids.listing,{optionId:option.id,enabled:true,legacyTier:null,expectedRevision:"1",reason:"Synthetic review"})).error?.code).toBe("conflict");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("prepares an exact-body server hash without publishing or accessing the service client",async()=>{
    const input={version:"synthetic-v2",body:"Exact body\n\n",expectedRevision:"3",reason:"Reviewed release wording"};
    const result=await prepareAdminSellerTerms(input);
    const {createHash}=await import("node:crypto");
    expect(result.termsReview).toEqual({...input,contentHash:createHash("sha256").update(input.body).digest("hex")});
    expect(mocks.client).not.toHaveBeenCalled();
    expect(result.mutationApplied).toBeUndefined();
  });
  it("rejects a changed terms body after hash review",async()=>{
    const result=await publishAdminSellerTerms(ids.listing,{version:"synthetic-v2",body:"Forged body",expectedRevision:"3",reason:"Reviewed wording",contentHash:"a".repeat(64)});
    expect(result.error?.code).toBe("invalid_input");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("publishes the exact reviewed body through the separate terms RPC with config CAS",async()=>{
    const {termsReview}=await prepareAdminSellerTerms({version:"synthetic-v2",body:"Reviewed exact body\n",expectedRevision:"3",reason:"Synthetic release review"});
    mocks.rpc.mockResolvedValueOnce({data:makeAdminCommerceFixture(),error:null})
      .mockResolvedValueOnce({data:{version:termsReview!.version,contentHash:termsReview!.contentHash,revision:"4"},error:null});
    expect((await publishAdminSellerTerms(ids.listing,termsReview)).mutationApplied).toBe(true);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"admin_publish_coaching_seller_terms",{p_actor_id:ids.actor,p_version:"synthetic-v2",p_body:"Reviewed exact body\n",p_expected_revision:"3"});
  });
  it("rejects stale terms config and returns data for a fresh review",async()=>{
    const {termsReview}=await prepareAdminSellerTerms({version:"synthetic-v2",body:"Reviewed exact body\n",expectedRevision:"2",reason:"Synthetic release review"});
    const result=await publishAdminSellerTerms(ids.listing,termsReview);
    expect(result.error?.code).toBe("conflict");expect(result.data?.configRevision).toBe("3");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
