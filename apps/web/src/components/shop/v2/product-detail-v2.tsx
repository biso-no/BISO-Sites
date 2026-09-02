import type { WebshopProducts } from "@repo/api/types/appwrite";
import { ArrowLeft, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddToCartClient } from "@/components/shop/add-to-cart-client";
import { MemberCalloutClient } from "@/components/shop/member-callout-client";
import { ProductOptionsClient } from "@/components/shop/product-options-client";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { normalizeCampusKey } from "@/lib/shop/pickup-locations";
import {
  calculateSavings,
  getDisplayPrice,
  type ProductOption,
  parseProductMetadata,
} from "@/lib/types/webshop";

/**
 * The product page, rebuilt on the design system.
 *
 * **Every interactive part is the v1 component, unchanged.**
 * `<AddToCartClient>`, `<ProductOptionsClient>` and `<MemberCalloutClient>` are
 * imported and given the identical prop list they receive today: this package
 * restyles the shop, and the cart, reservation and checkout paths carry real
 * money. The price arithmetic is likewise the same `getDisplayPrice` /
 * `calculateSavings` the current page calls.
 *
 * What changes is the frame around them — and the back control, which v1
 * renders as a bare `<Link>` dropped inside an absolutely-positioned flex row
 * next to the title block, where it lands on top of the hero rather than above
 * it. Here it is a breadcrumb, like every other detail page.
 *
 * `formatPrice` is not used: it returns the literal string "Free" regardless of
 * locale. The label comes from the message bundle instead.
 */
export interface ProductDetailV2Props {
  availableStock: number | null;
  isMember: boolean;
  locale: "en" | "no";
  product: WebshopProducts;
  userId: string | null;
}

export async function ProductDetailV2({
  availableStock,
  isMember,
  locale,
  product,
  userId,
}: ProductDetailV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const translation = getPrimaryTranslation(product, locale);
  const title = translation?.title ?? "";
  const description = translation?.description ?? "";

  const metadata = parseProductMetadata(product.metadata);
  const productOptions = (metadata.product_options as ProductOption[]) || [];

  const regularPrice = product.regular_price ?? 0;
  const memberPrice = product.member_price;
  const displayPrice = getDisplayPrice(regularPrice, memberPrice, isMember);
  const hasDiscount =
    isMember && typeof memberPrice === "number" && memberPrice < regularPrice;
  const savings = calculateSavings(regularPrice, memberPrice);

  const price = (amount: number) =>
    amount > 0 ? `${amount} NOK` : t("card.free");

  const campusName = product.campus?.name ?? null;
  const pickupLocation = t(`pickup.campus.${normalizeCampusKey(campusName)}`);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("shop"), href: "/shop" },
          { label: title },
        ]}
        lede={translation?.short_description ?? undefined}
        meta={
          <>
            {product.category ? (
              <Pill tone="accent" uppercase>
                {product.category}
              </Pill>
            ) : null}
            {product.member_only ? (
              <Pill tone="warning">{t("card.membersOnly")}</Pill>
            ) : null}
            {hasDiscount && savings > 0 ? (
              <Pill tone="success">{t("card.save", { amount: savings })}</Pill>
            ) : null}
            <Pill tone="neutral">
              {hasDiscount
                ? `${price(displayPrice)} · ${price(regularPrice)}`
                : price(displayPrice)}
            </Pill>
          </>
        }
        title={title}
      />

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* The buying controls come first on a phone: on a product page the
              price and the button are what the reader came for, and the
              description is what they read to decide. `order` puts the column
              back on the right at desktop. */}
          <aside className="space-y-6 lg:order-2">
            <AddToCartClient
              availableStock={availableStock}
              displayPrice={displayPrice}
              hasDiscount={hasDiscount}
              isMember={isMember}
              memberPrice={memberPrice}
              product={product}
              regularPrice={regularPrice}
              savings={savings}
              stock={product.stock}
              userId={userId}
            />

            {isMember || product.category === "Membership" ? null : (
              <MemberCalloutClient />
            )}
          </aside>

          <div className="min-w-0 space-y-10 lg:order-1">
            {product.image ? (
              <ChevronFrame className="bg-surface-sunken" ratio="4/3">
                <Image
                  alt=""
                  height={720}
                  priority
                  sizes="(max-width: 1024px) 100vw, 760px"
                  src={product.image}
                  width={960}
                />
              </ChevronFrame>
            ) : null}

            {description ? (
              <div>
                <h2 className="type-heading-section text-ink">
                  {t("product.description")}
                </h2>
                {/* Product copy is plain text, not block-editor output, so the
                    authored line breaks are the only structure it has. */}
                <Prose className="mt-5">
                  <p className="whitespace-pre-line">{description}</p>
                </Prose>
              </div>
            ) : null}

            {productOptions.length > 0 ? (
              <ProductOptionsClient
                productOptions={productOptions}
                productRefId={product.$id}
              />
            ) : null}

            <div className="flex items-start gap-3 rounded-biso-md bg-surface-sunken p-5">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-ink-accent"
              />
              <div>
                <h2 className="type-label text-ink">{t("pickup.cardTitle")}</h2>
                <p className="type-body-sm mt-1 text-ink-muted">
                  <span className="text-ink">{t("pickup.locationLabel")}:</span>{" "}
                  {pickupLocation}
                </p>
                <p className="type-body-sm mt-2 text-ink-muted">
                  {t("pickup.emailNote")}
                </p>
              </div>
            </div>

            <Link
              className="inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/shop"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span className="type-label">{t("product.backToShop")}</span>
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
