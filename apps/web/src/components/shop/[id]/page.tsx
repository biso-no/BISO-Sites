import { getLocale } from "@/app/actions/locale";
import { getProductBySlug } from "@/app/actions/webshop";
import { AddToCartCard } from "../product/add-to-cart-card";
import { MemberBenefits } from "../product/member-benefits";
import { PickupInfo } from "../product/pickup-info";
import { ProductDescription } from "../product/product-description";
import { ProductHero } from "../product/product-hero";
import { ProductOptions } from "../product/product-options";
import { ProductPriceCard } from "../product/product-price-card";
import { ProductPurchaseProvider } from "../product/product-purchase-provider";
import { StockStatus } from "../product/stock-status";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const product = await getProductBySlug(slug, locale);

  if (!product) {
    return <div>Product not found</div>;
  }

  // TODO: Get actual member status from auth
  const isMember = false;
  const userId = null;

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <ProductHero isMember={isMember} product={product} />

      <ProductPurchaseProvider
        isMember={isMember}
        product={product}
        userId={userId}
      >
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="space-y-8 lg:col-span-2">
              <ProductDescription description={product.description} />
              <ProductOptions />
              <PickupInfo />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <StockStatus />
              <AddToCartCard />
              <ProductPriceCard isMember={isMember} product={product} />
              {!isMember && product.product_ref?.category !== "Membership" && (
                <MemberBenefits />
              )}
            </div>
          </div>
        </div>
      </ProductPurchaseProvider>
    </div>
  );
}
