import { resolveStorageFileUrl } from "@repo/api/storage";
import type { WebshopProducts } from "@repo/api/types/appwrite";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowLeft, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddToCartClient } from "@/components/shop/add-to-cart-client";
import { MemberCalloutClient } from "@/components/shop/member-callout-client";
import { ProductCustomFieldsProvider } from "@/components/shop/product-custom-fields-context";
import { ProductOptionsClient } from "@/components/shop/product-options-client";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { toPlainText } from "@/lib/content-text";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { normalizeCampusKey } from "@/lib/shop/pickup-locations";
import {
  type ProductCustomFieldRow,
  toProductCustomFields,
} from "@/lib/types/product";
import { calculateSavings, getDisplayPrice } from "@/lib/types/webshop";

/**
 * The product page, rebuilt on the design system: the detail template with a
 * sticky buy card (spec §4.6).
 *
 * **The purchase logic is the shared client components', unchanged.**
 * `<AddToCartClient>` carries the members-only gate, the required-answer check
 * and the stock and per-buyer limits; `<ProductOptionsClient>` renders the
 * product's checkout questions from `product_custom_fields`; both read the
 * answers through `<ProductCustomFieldsProvider>`. The cart, reservation and
 * checkout paths carry real money, and every refusal made here is made again
 * server-side. The price arithmetic is the same `getDisplayPrice` /
 * `calculateSavings` the cart uses.
 *
 * The questions sit inside the buy card, between the price and the button. On
 * a phone the card comes before the description, so a question left down in
 * the body would be out of sight of the button that refuses without it.
 *
 * A members-only product renders for everyone, with its pill: `member_only`
 * limits who can buy, not who can see. A link-only (`unlisted`) product renders
 * like any other — it is only absent from listings, and `generateMetadata`
 * marks it `noindex`.
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
  // The header lede is a bare string slot, so the teaser has to arrive as text.
  const lede = toPlainText(translation?.short_description) || undefined;
  // Legacy imports store a bare Appwrite file ID in `image` rather than a URL.
  const imageUrl = resolveStorageFileUrl(product.image);

  // Definitions live in `product_custom_fields`; `metadata.product_options`
  // was never written by anything and never rendered a single field.
  const customFields = toProductCustomFields(
    (product as { custom_fields?: ProductCustomFieldRow[] }).custom_fields
  );

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
        lede={lede}
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
              price, the questions and the button are what the reader came
              for, and the description is what they read to decide. `order`
              puts the column back on the right at desktop, where it becomes
              the sticky rail the detail template calls for. */}
          <aside className="lg:order-2">
            <div className="space-y-6 lg:sticky lg:top-24">
              <ProductCustomFieldsProvider fields={customFields}>
                <AddToCartClient
                  availableStock={availableStock}
                  displayPrice={displayPrice}
                  hasDiscount={hasDiscount}
                  isMember={isMember}
                  memberPrice={memberPrice}
                  product={product}
                  questions={<ProductOptionsClient />}
                  regularPrice={regularPrice}
                  savings={savings}
                  stock={product.stock}
                  userId={userId}
                />
              </ProductCustomFieldsProvider>

              {isMember || product.category === "Membership" ? null : (
                <MemberCalloutClient />
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-10 lg:order-1">
            {imageUrl ? (
              <ChevronFrame className="bg-surface-sunken" ratio="4/3">
                <Image
                  alt=""
                  height={720}
                  priority
                  sizes="(max-width: 1024px) 100vw, 760px"
                  src={imageUrl}
                  width={960}
                />
              </ChevronFrame>
            ) : null}

            {description ? (
              <div>
                <h2 className="type-heading-section text-ink">
                  {t("product.description")}
                </h2>
                {/* Product copy comes out of the CMS's rich-text editor like
                    every other body field — rendered as plain text it printed
                    its own markup. Same reader the news, events and jobs
                    details use. */}
                <Prose className="mt-5">
                  <PlateContentRenderer value={description || null} />
                </Prose>
              </div>
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
