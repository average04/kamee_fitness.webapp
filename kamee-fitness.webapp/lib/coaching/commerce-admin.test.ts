import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeAdminCommerceFixture, adminFixtureIds as ids } from "./commerce-admin-fixtures";
import { formatAdminMoney, parseAdminOptionInput, parseAdminTermsInput, createExclusiveRunner } from "./commerce-admin";
import { ProductReadinessPanel } from "@/components/coaching/commerce/ProductReadinessPanel";

describe("product readiness operator contract",()=>{
  it("formats money using integer minor units",()=>{
    expect(formatAdminMoney({currency:"PHP",exponent:2,minor:"2000000"})).toBe("PHP 20,000");
  });
  it("requires exact option inputs and canonical CAS",()=>{
    const input={optionId:ids.product,enabled:false,legacyTier:null,expectedRevision:"0",reason:"Reviewed release decision"};
    expect(parseAdminOptionInput(input)).toEqual(input);
    expect(()=>parseAdminOptionInput({...input,expectedRevision:"01"})).toThrow();
    expect(()=>parseAdminOptionInput({...input,salesEnabled:true})).toThrow();
  });
  it("preserves the reviewed exact terms body and rejects a missing reason",()=>{
    const input={version:"synthetic-v2",body:"Exact body\n\n",expectedRevision:"3",reason:"Reviewed wording"};
    expect(parseAdminTermsInput(input).body).toBe("Exact body\n\n");
    expect(()=>parseAdminTermsInput({...input,reason:""})).toThrow();
  });
  it("blocks duplicate submits and releases its lock after an error for explicit retry",async()=>{
    const run=createExclusiveRunner();
    let release!:()=>void;
    const work=new Promise<void>(resolve=>{release=resolve});
    const pending=run(()=>work);
    expect(await run(async()=>"duplicate")).toBeUndefined();
    release(); await pending;
    await expect(run(async()=>{throw new Error("retryable")})).rejects.toThrow("retryable");
    expect(await run(async()=>"retried")).toBe("retried");
  });
  it("renders four independent rows, all 45 disabled options, read-only capability and escaped opaque evidence",()=>{
    const data=makeAdminCommerceFixture(false);
    data.products[0].environments[0].verifiedEvidenceRef='<script>alert("x")</script>';
    const html=renderToStaticMarkup(createElement(ProductReadinessPanel,{initialData:data}));
    for(const text of ["iOS · SANDBOX","iOS · PRODUCTION","Android · SANDBOX","Android · PRODUCTION","Read-only product setup","45 reference prices","Sales disabled"]) expect(html).toContain(text);
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
    expect((html.match(/Disabled · revision/g)||[]).length).toBe(45);
    expect(html).not.toContain("Enable sales");
  });
  it("keeps a previous effective offer visible when the requested-price setup failed",()=>{
    const data=makeAdminCommerceFixture(true), row=data.workspace.platforms[0];
    row.state="active"; row.setupOutcome="failed"; row.effective={...data.workspace.pricing.requested!,id:ids.offer,referenceMoney:{currency:"PHP",exponent:2,minor:"30000"}};
    row.offerRevision=ids.offer;row.matchesCurrentVersion=true;row.effectiveVersionId=ids.version;row.effectiveVersionNo=1;
    const html=renderToStaticMarkup(createElement(ProductReadinessPanel,{initialData:data}));
    expect(html).toContain("PHP 300");expect(html).toContain("Previous effective offer remains");expect(html).toContain("Setup outcome: failed");
  });
});
