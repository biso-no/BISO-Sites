import type { WebshopProducts } from "@repo/api/types/appwrite";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { CAMPUS_SLUGS, campusIdToSlug } from "@/lib/campus-scope";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { ShopSearch } from "./shop-search";

/**
 * The shop listing, rebuilt as a Server Component.
 *
 * **The category filter matched nothing.** `SHOP_CATEGORIES` is a hardcoded
 * four-value list — Merch, Trips, Lockers, Membership — and `category` is a
 * free-text column that holds none of them: of 55 published products, 49 carry
 * no category at all and the six that do read "Staff Functions", "Clothing",
 * "Ukategorisert", "BISO Membership" and "Trondheim". So every one of the four
 * chips returned an empty shop. Chips are derived from the data here, which at
 * least means every chip returns something; the column itself needs cleaning
 * up, and that is a content job, not a rendering one.
 *
 * **Nothing linked to a product.** `ProductCard`'s button called
 * `router.push`, so `/shop/[slug]` had no crawlable link, no middle-click and
 * no open-in-new-tab from the shop. Cards are links.
 *
 * **The list re-fetched itself on hydration.** Campus lived in a context, so
 * the client re-ran `listProducts` in an effect and threw the server render
 * away. Campus is `?campus=` now, resolved on the server like every other feed.
 *
 * Prices are unchanged: `regular_price`, `member_price` and the member state
 * come from the same places, and nothing here writes.
 */
export interface ShopV2Props {
  campusId: string | null;
  isMember: boolean;
  locale: "en" | "no";
  products: WebshopProducts[];
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
}

interface CardLabels {
  free: string;
  membersOnly: string;
  membersPay: (price: string) => string;
  save: (amount: number) => string;
  soldOut: string;
}

function priceLabel(amount: number, free: string): string {
  return amount > 0 ? `${amount} NOK` : free;
}

function ProductPrice({
  product,
  isMember,
  labels,
}: {
  isMember: boolean;
  labels: CardLabels;
  product: WebshopProducts;
}) {
  const memberPrice = product.member_price;
  const discounted =
    memberPrice !== null &&
    memberPrice !== undefined &&
    memberPrice < product.regular_price;

  if (discounted && isMember) {
    return (
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="type-data text-ink-muted line-through">
          {priceLabel(product.regular_price, labels.free)}
        </span>
        <span className="type-heading-card text-ink-accent">
          {priceLabel(memberPrice, labels.free)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span className="type-heading-card text-ink">
        {priceLabel(product.regular_price, labels.free)}
      </span>
      {discounted ? (
        <span className="type-body-sm mt-1 text-ink-muted">
          {labels.membersPay(priceLabel(memberPrice, labels.free))}
        </span>
      ) : null}
    </span>
  );
}

function ProductCard({
  product,
  locale,
  isMember,
  labels,
}: {
  isMember: boolean;
  labels: CardLabels;
  locale: "en" | "no";
  product: WebshopProducts;
}) {
  const translation = getPrimaryTranslation(product, locale);
  const soldOut = product.stock === 0;
  const savings =
    product.member_price !== null && product.member_price !== undefined
      ? product.regular_price - product.member_price
      : 0;

  return (
    <li>
      <Link
        className="group flex h-full flex-col rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        href={`/shop/${product.slug}`}
      >
        {/* Only where there is a picture. The news feed draws an empty frame on
            every card so a picture-less article does not float its headline
            above its neighbours', but that trade only pays when images are the
            norm: **39 of the 55 products have none**, so the same rule filled
            the shop with grey parallelograms carrying no information. Prices
            still line up — they are pinned to the bottom of the row. */}
        {product.image ? (
          <ChevronFrame className="mb-4 bg-surface-sunken" ratio="16/9">
            <Image
              alt=""
              className="transition-transform duration-500 group-hover:scale-[1.03]"
              height={480}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
              src={product.image}
              width={640}
            />
          </ChevronFrame>
        ) : null}

        <span className="flex flex-wrap gap-2">
          {product.category ? (
            <Pill tone="accent" uppercase>
              {product.category}
            </Pill>
          ) : null}
          {product.member_only ? (
            <Pill tone="warning">{labels.membersOnly}</Pill>
          ) : null}
          {!isMember && savings > 0 ? (
            <Pill tone="success">{labels.save(savings)}</Pill>
          ) : null}
          {soldOut ? <Pill tone="danger">{labels.soldOut}</Pill> : null}
        </span>

        <span className="type-heading-card mt-3 block text-ink group-hover:text-ink-accent">
          {translation?.title}
        </span>

        {translation?.short_description ? (
          <span className="type-body-sm mt-2 line-clamp-2 text-ink-muted">
            {translation.short_description}
          </span>
        ) : null}

        <span className="mt-auto pt-4">
          <ProductPrice isMember={isMember} labels={labels} product={product} />
        </span>
      </Link>
    </li>
  );
}

export async function ShopV2({
  campusId,
  isMember,
  locale,
  products,
  searchParams,
  searchQuery,
}: ShopV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const activeCategory =
    typeof searchParams.category === "string" ? searchParams.category : "all";

  const present = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort() as string[];

  const categoryOptions: FilterOption[] = [
    { value: "all", label: t("filters.all") },
    ...present.map((category) => ({
      value: category,
      label: category,
      count: products.filter((product) => product.category === category).length,
    })),
  ];

  const campusOptions: FilterOption[] = [
    { value: "all", label: tNav("allCampuses") },
    ...CAMPUS_SLUGS.map((slug) => ({
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
    })),
  ];

  const visible =
    activeCategory === "all"
      ? products
      : products.filter((product) => product.category === activeCategory);

  const activeCampus = campusIdToSlug(campusId) ?? "all";
  const hidden: Record<string, string> = {};
  if (activeCampus !== "all") {
    hidden.campus = activeCampus;
  }
  if (activeCategory !== "all") {
    hidden.category = activeCategory;
  }

  const labels: CardLabels = {
    free: t("card.free"),
    membersOnly: t("card.membersOnly"),
    membersPay: (price) => t("card.membersPay", { price }),
    save: (amount) => t("card.save", { amount }),
    soldOut: t("card.outOfStock"),
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("shop") },
        ]}
        lede={t("hero.description")}
        meta={
          isMember ? <Pill tone="success">{t("hero.memberBadge")}</Pill> : null
        }
        title={tNav("shop")}
      />

      <Section tone="paper">
        <div className="mb-8 space-y-4">
          <ShopSearch
            defaultValue={searchQuery}
            hidden={hidden}
            label={t("list.searchLabel")}
            placeholder={t("filters.searchPlaceholder")}
            submitLabel={t("list.searchSubmit")}
          />
          <FilterChips
            active={activeCategory}
            basePath="/shop"
            label={t("list.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={searchParams}
          />
          <FilterChips
            active={activeCampus}
            basePath="/shop"
            label={t("list.campusLabel")}
            options={campusOptions}
            param="campus"
            searchParams={searchParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {t("filters.showingResults", { count: visible.length })}
        </p>

        {visible.length > 0 ? (
          <CardGrid className="gap-x-6 gap-y-10">
            {visible.map((product) => (
              <ProductCard
                isMember={isMember}
                key={product.$id}
                labels={labels}
                locale={locale}
                product={product}
              />
            ))}
          </CardGrid>
        ) : (
          <div>
            <p className="type-heading-card text-ink">
              {t("emptyState.title")}
            </p>
            <p className="type-body mt-2 text-ink-muted">
              {t("emptyState.description")}
            </p>
            <Link
              className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/shop"
            >
              {t("filters.clearFilters")}
            </Link>
          </div>
        )}
      </Section>

      {/* Every order is collected in person, so where and when is not a
          marketing band — it is the delivery method. Kept from v1, restyled. */}
      <Section className="border-edge border-t" tone="paper">
        <h2 className="type-heading-section text-ink">{t("pickup.title")}</h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("pickup.description")}
        </p>
        <p className="type-body-sm mt-4 text-ink">
          <strong className="font-semibold">{t("pickup.officeHours")}</strong>{" "}
          {t("pickup.hours")}
        </p>
      </Section>
    </>
  );
}
