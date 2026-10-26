import Link from "next/link";
import { ProductReadinessPanel } from "@/components/coaching/commerce/ProductReadinessPanel";
import { requireAdmin } from "@/lib/admin/auth";
import { refreshAdminProductWorkspace, registerAdminStoreProduct, setAdminProductReadiness, setAdminPriceOption, prepareAdminSellerTerms, publishAdminSellerTerms } from "../actions";

export default async function AdminProductPage({params}:{params:Promise<{listingId:string}>}) {
  const actor=await requireAdmin();
  const {listingId}=await params;
  const result=await refreshAdminProductWorkspace(listingId);
  return <><Link href="/admin/coaching-commerce">← Product readiness listings</Link>{result.data?
    <ProductReadinessPanel key={`${actor.id}:${listingId}`} initialData={result.data} initialError={result.error?.message} actions={{refresh:refreshAdminProductWorkspace,register:registerAdminStoreProduct,readiness:setAdminProductReadiness,option:setAdminPriceOption,prepareTerms:prepareAdminSellerTerms,publishTerms:publishAdminSellerTerms}}/>:
    <section className="my-6"><h1 className="text-2xl font-semibold">Product readiness unavailable</h1><p role="alert" className="my-4 text-amber-200">{result.error?.message}</p><Link href={`/admin/coaching-commerce/${encodeURIComponent(listingId)}`}>Retry loading readiness</Link></section>}</>;
}
